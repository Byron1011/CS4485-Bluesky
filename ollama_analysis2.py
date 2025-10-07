import pandas as pd
import ollama
from sklearn.metrics import accuracy_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

def load_and_preprocess_data(file_path):
    df = pd.read_csv(file_path)
    print(f"Dataset loaded. First few rows:\n{df.head()}\n")
    
    if 'Text' not in df.columns or 'Label' not in df.columns:
        raise ValueError("Dataset must contain 'Text' and 'Label' columns.")
    
    df['Text'] = df['Text'].str.lower().str.strip()
    
    return df

# ollama api usage
def classify_with_ollama(texts):

    client = ollama.Client()
    prompt = "Classify the following text as disaster-related (1) or not disaster-related (0):\n"
    
    results = []
    for text in texts:
        response = client.chat(model="deepseek-r1:8b", messages=[{"role": "user", "content": f"{prompt}{text}"}])
        
        print(f"Response: {response}")
        
        try:
            prediction = response['choices'][0]['message']['content'].strip().lower()
        except KeyError:
            print("Error: Could not access response correctly.")
            prediction = ""
        
        if prediction == '1':
            results.append(1)
        else:
            results.append(0)
    
    return results

def evaluate_model(predictions, true_labels):

    accuracy = accuracy_score(true_labels, predictions)
    precision = precision_score(true_labels, predictions)
    recall = recall_score(true_labels, predictions)
    
    print(f"Accuracy: {accuracy:.2f}")
    print(f"Precision: {precision:.2f}")
    print(f"Recall: {recall:.2f}")
    
    return accuracy, precision, recall

def main(file_path):

    df = load_and_preprocess_data(file_path)
    X_train, X_test, y_train, y_test = train_test_split(df['Text'], df['Label'], test_size=0.2, random_state=42)
    predictions = classify_with_ollama(X_test)
    evaluate_model(predictions, y_test)

if __name__ == "__main__":
    file_path = "tweets.csv"
    main(file_path)
