from transformers import pipeline
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report
import pandas as pd
import matplotlib.pyplot as plt

# initialize the model and dataset
model = pipeline("text-classification", model ="elam2909/bert-disaster-classifier")
df = pd.read_csv("disaster_classifier_test_dataset.csv")
#subset_df = df.sample(n=1000, random_state=42)

# set labels properly
texts = df["post_text"].tolist()
true_labels = df["relevant"].tolist()

# run predictions
predictions = [model(t, truncation=True)[0]["label"] for t in texts]

# map the labels to numbers for the confusion matrix
label_map = {"disaster": 1, "not_disaster": 0, "LABEL_1": 1, "LABEL_0": 0, "1": 1, "0": 0}
pred_labels = [label_map.get(p, p) for p in predictions]

# runs and shows the confusion matrix
matrix = confusion_matrix(true_labels, pred_labels)
disp = ConfusionMatrixDisplay(confusion_matrix=matrix)
disp.plot(cmap=plt.cm.Blues)
plt.title("Confusion Matrix")
plt.show()

# runs and shows the classification report
print("\nClassification Report:\n")
print(classification_report(true_labels, pred_labels))

# testing the model by giving it a message to see what it shows
#response = model("had a good day today")
#print(response)