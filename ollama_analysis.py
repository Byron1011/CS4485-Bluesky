import pandas as pd
import ollama
from sklearn.metrics import accuracy_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer

def load_and_preprocess_data(file_path):

    df = pd.read_csv(file_path)
    print(f"Dataset loaded. First few rows:\n{df.head()}\n")
    
    if 'Text' not in df.columns or 'Label' not in df.columns:
        raise ValueError("Dataset must contain 'Text' and 'Label' columns.")
    
    df['Text'] = df['Text'].str.lower().str.strip()
    
    return df

def prepare_data_for_finetuning(df):

    train_data = [{"text": row['Text'], "label": row['Label']} for index, row in df.iterrows()]
    print(f"Prepared data for fine-tuning. Sample:\n{train_data[:3]}")
    
    return train_data

# using ollama to train model
def finetune_model(train_data):
    client = ollama.Client()
    
    print("Starting fine-tuning process...")
    response = client.finetune(
        model="deepseek-r1:8b", 
        data=train_data,
        task="text_classification",
        epochs=3, 
        batch_size=8,
        learning_rate=1e-5 
    )
    
    print("Fine-tuning complete. Response:\n", response)
    
    return response

def evaluate_model(client, model_name, test_data, true_labels):

    predictions = client.predict(model=model_name, inputs=test_data)
    predicted_labels = [prediction['label'] for prediction in predictions]
    
    accuracy = accuracy_score(true_labels, predicted_labels)
    precision = precision_score(true_labels, predicted_labels)
    recall = recall_score(true_labels, predicted_labels)
    
    print(f"Accuracy: {accuracy:.2f}")
    print(f"Precision: {precision:.2f}")
    print(f"Recall: {recall:.2f}")
    
    return accuracy, precision, recall

def main(file_path):

    df = load_and_preprocess_data(file_path)
    train_data = prepare_data_for_finetuning(df)
    response = finetune_model(train_data)
    X_train, X_test, y_train, y_test = train_test_split(df['Text'], df['Label'], test_size=0.2, random_state=42)
    test_data = [{"text": text} for text in X_test]
    evaluate_model(ollama.Client(), response['model_name'], test_data, y_test)

if __name__ == "__main__":
    file_path = "tweets.csv"
    main(file_path)

