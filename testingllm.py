from transformers import pipeline
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report
import pandas as pd
import matplotlib.pyplot as plt

model = pipeline("text-classification", model ="elam2909/bert-disaster-classifier")
df = pd.read_csv("tweets.csv")
subset_df = df.sample(n=1000, random_state=42)

texts = subset_df["Text"].tolist()
true_labels = subset_df["Label"].tolist()

predictions = [model(t, truncation=True)[0]["label"] for t in texts]

label_map = {"disaster": 1, "not_disaster": 0, "LABEL_1": 1, "LABEL_0": 0}
pred_labels = [label_map.get(p, p) for p in predictions]

matrix = confusion_matrix(true_labels, pred_labels)
disp = ConfusionMatrixDisplay(confusion_matrix=matrix)
disp.plot(cmap=plt.cm.Blues)
plt.title("Confusion Matrix on Subset")
plt.show()

print("\nClassification Report on Subset:\n")
print(classification_report(true_labels, pred_labels))

#response = model("had a good day today")
#print(response)