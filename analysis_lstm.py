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

# create encoder: learns strings of text from the data and turns them to a vocab
# (numbers) that a model can understand
encoder = tf.keras.layers.TextVectorization(max_tokens=2000)
encoder.adapt(train_data.map(lambda text, label: text))
vocab = np.array(encoder.get_vocabulary())

model = tf.keras.Sequential([
    # these layers take the text and encodes them
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
    tf.keras.layers.Dropout(0.4),  # prevents overfitting by dropping random neurons
    tf.keras.layers.Dense(1, activation='sigmoid')
])

# compile model with specified optimizer, loss function, it will be judged by accuracy
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
              loss=tf.keras.losses.BinaryCrossentropy(),
              metrics=['accuracy'])

# test model initially, should not be too good since it is random
model.evaluate(train_data)
model.evaluate(valid_data)

# TRAIN MODEL, keep track of history at each stage in case it is important later
history = model.fit(train_data, epochs=10, validation_data=valid_data)

# FINAL TEST, how good is out disaster (or not) classifier
model.evaluate(test_data)

test_tweet = tf.constant(["Everybody be careful, there is a magnitude 3 earthquake in Dallas."])
prediction = model.predict(test_tweet)

print(prediction)