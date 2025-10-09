import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.metrics import confusion_matrix, classification_report

# create dataframe from file
df = pd.read_csv("tweets.csv")

small_df = df[["Text", "Label"]]

train, val, test = np.split(small_df.sample(frac=1, random_state=42), [int(0.8*len(small_df)), int(0.9*len(small_df))])

def df_to_dataset(dataframe, shuffle=True, batch_size=1024):
    df = dataframe.copy()
    labels = df.pop('Label')
    df = df["Text"]
    ds = tf.data.Dataset.from_tensor_slices((df, labels))
    if shuffle:
        ds = ds.shuffle(buffer_size=len(dataframe))
    ds = ds.batch(batch_size)
    ds = ds.prefetch(tf.data.AUTOTUNE)
    return ds

train_data = df_to_dataset(train)
valid_data = df_to_dataset(val)
test_data = df_to_dataset(test, shuffle=False)

encoder = tf.keras.layers.TextVectorization(max_tokens=2000)
encoder.adapt(train_data.map(lambda text, label: text))
vocab = np.array(encoder.get_vocabulary())

# transformer model
def transformer_encoder(inputs, head_size, num_heads, ff_dim, dropout=0.1):

    # multi head attention
    attention = tf.keras.layers.MultiHeadAttention(num_heads=num_heads, key_dim=head_size)(inputs, inputs)
    attention = tf.keras.layers.Dropout(dropout)(attention)
    attention = tf.keras.layers.LayerNormalization(epsilon=1e-6)(inputs + attention)

    # feed forward layer
    ffn = tf.keras.layers.Dense(ff_dim, activation='relu')(attention)
    ffn = tf.keras.layers.Dense(inputs.shape[-1])(ffn)
    ffn = tf.keras.layers.Dropout(dropout)(ffn)
    ffn = tf.keras.layers.LayerNormalization(epsilon=1e-6)(attention + ffn)

    return ffn

inputs = tf.keras.Input(shape=(), dtype=tf.string)

x = encoder(inputs)

x = tf.keras.layers.Embedding(input_dim=len(encoder.get_vocabulary()), output_dim=32, mask_zero=True)(x)

x = transformer_encoder(x, head_size=32, num_heads=2, ff_dim=32, dropout=0.1)

x = tf.keras.layers.GlobalAveragePooling1D()(x) # pooling the features across time steps
x = tf.keras.layers.Dense(32, activation='relu')(x)
x = tf.keras.layers.Dropout(0.4)(x)
outputs = tf.keras.layers.Dense(1, activation='sigmoid')(x)

model = tf.keras.Model(inputs=inputs, outputs=outputs)

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
              loss=tf.keras.losses.BinaryCrossentropy(),
              metrics=['accuracy'])

history = model.fit(train_data, epochs=10, validation_data=valid_data)

# evaluate on test set
test_loss, test_acc = model.evaluate(test_data)
print(f"\nTest Accuracy: {test_acc:.4f}")

# computes predictions for confusion matrix
texts = list(test["Text"])
true_labels = np.array(test["Label"])
pred_probs = model.predict(tf.constant(texts))
pred_labels = (pred_probs > 0.5).astype(int).flatten()

cm = confusion_matrix(true_labels, pred_labels)
tn, fp, fn, tp = cm.ravel()

# calculates positive and negative rates
total = tn + fp + fn + tp
rates = {
    "True Positive Rate": tp / (tp + fn) if (tp + fn) else 0,
    "False Positive Rate": fp / (fp + tn) if (fp + tn) else 0,
    "True Negative Rate": tn / (tn + fp) if (tn + fp) else 0,
    "False Negative Rate": fn / (fn + tp) if (fn + tp) else 0
}

conf_table = pd.DataFrame({
    "Metric": ["True Positives", "False Positives", "True Negatives", "False Negatives"],
    "Count": [tp, fp, tn, fn]
})

print("\n=== Confusion Matrix ===")
print(conf_table.to_string(index=False))

print("\n=== Rates ===")
for k, v in rates.items():
    print(f"{k}: {v:.4f}")

# classification report
print("\n=== Classification Report ===")
print(classification_report(true_labels, pred_labels, digits=4))

# sample test
test_tweet = tf.constant(["Everybody be careful, there is a magnitude 3 earthquake in Dallas."])
prediction = model.predict(test_tweet)
print("\nSample Prediction:", prediction)
