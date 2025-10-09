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

# create encoder: learns strings of text from the data and turns them to a vocab
# (numbers) that a model can understand
encoder = tf.keras.layers.TextVectorization(max_tokens=2000)
encoder.adapt(train_data.map(lambda text, label: text))
vocab = np.array(encoder.get_vocabulary())

model = tf.keras.Sequential([
    # these layers take the text and encode them
    encoder,
    tf.keras.layers.Embedding(
        input_dim=len(encoder.get_vocabulary()),
        output_dim=32,
        mask_zero=True
    ),

    # Long Short Term Memory
    tf.keras.layers.LSTM(32),

    # Standard layers
    tf.keras.layers.Dense(32, activation='relu'),
    tf.keras.layers.Dropout(0.4),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

# compile model with specified optimizer, loss function, it will be judged by accuracy
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
              loss=tf.keras.losses.BinaryCrossentropy(),
              metrics=['accuracy'])

# train model, keep track of history at each stage in case its important later
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
