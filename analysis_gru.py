import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import tensorflow as tf

# create dataframe from file
df = pd.read_csv("tweets.csv")

df.head()

small_df = df[["Text","Label"]]
small_df.head()

train, val, test = np.split(small_df.sample(frac=1), [int(0.8*len(small_df)), int(0.9*len(small_df))])

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
test_data = df_to_dataset(test)

encoder = tf.keras.layers.TextVectorization(max_tokens=2000)
encoder.adapt(train_data.map(lambda text, label: text))
vocab = np.array(encoder.get_vocabulary())

# gru model
inputs = tf.keras.Input(shape=(), dtype=tf.string)

x = encoder(inputs)

x = tf.keras.layers.Embedding(input_dim=len(encoder.get_vocabulary()), output_dim=32, mask_zero=True)(x)

# gru layer
x = tf.keras.layers.GRU(32, return_sequences=True)(x)
x = tf.keras.layers.GlobalAveragePooling1D()(x) 
x = tf.keras.layers.Dense(32, activation='relu')(x)
x = tf.keras.layers.Dropout(0.4)(x)

outputs = tf.keras.layers.Dense(1, activation='sigmoid')(x)

model = tf.keras.Model(inputs=inputs, outputs=outputs)

model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
              loss=tf.keras.losses.BinaryCrossentropy(),
              metrics=['accuracy'])

model.evaluate(train_data)
model.evaluate(valid_data)

history = model.fit(train_data, epochs=10, validation_data=valid_data)

model.evaluate(test_data)

test_tweet = tf.constant(["Everybody be careful, there is a magnitude 3 earthquake in Dallas."])
prediction = model.predict(test_tweet)

print(prediction)
