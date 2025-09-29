import json
import re
from collections import defaultdict
from datetime import datetime

def countOfDisasterTerms(filePath, outfilePath, words, textField='text', timestampField='created_at'):
    # dictionary that holds word amounts and timestamp information, along with converting the words to lowercase
    wordAmount = defaultdict(int)
    timestampInfo = []
    words = [word.lower() for word in words]

    with open(filePath, 'r', encoding='utf-8') as file, open(outfilePath, 'w', encoding='utf-8') as outfile:
        for line in file:
            try:
                # data and timestamp extraction
                data = json.loads(line)
                timestamp = data.get(timestampField, None)

                # parses timestamp
                if timestamp:
                    try:
                        timestampObject = datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp
                        timestampInfo.append(timestampObject)
                    except Exception as e:
                        print(f"Error parsing timestamp: {e}")
                
                # variable used for determining if a line of text had a match or not
                match = False

                # parses text for the disaster related words
                for key, value in data.items():
                    if isinstance(value, str):
                        value = value.lower()

                        # counts each word occurence and adds it to the list
                        for word in words:
                            count = len(re.findall(r'\b' + re.escape(word) + r'\b', value))
                            if count > 0:
                                wordAmount[word] += count
                                match = True

                # parsing through each match and printing each line of text and timestamp per match
                if match:
                    if timestampInfo:
                        timestampString = timestampInfo[-1].strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        timestampString = "No timestamp found."

                    out = {
                        "Line": data.get(textField, ""),
                        "Timestamp": timestampString
                    }
                    outfile.write(json.dumps(out) + "\n")
                            
            except json.JSONDecodeError:
                print(f"Error decoding JSON: {line}")
            except Exception as e:
                print(f"An error occurred: {e}")

    return wordAmount, timestampInfo

filePath = 'posts_019.jsonl'
outfilePath = 'output.jsonl'
words = ['earthquake', 'flood', 'tornado', 'hurricane']
textField = 'text'
timestampField = 'created_at'
wordAmount, timestampInfo = countOfDisasterTerms(filePath, outfilePath, words, textField, timestampField)

# prints the summary of the data
with open('outputsummary.jsonl', 'w') as f:
    if wordAmount:
        for word, count in wordAmount.items():
            if timestampInfo:
                timestampString = timestampInfo[0].strftime('%Y-%m-%d %H:%M:%S')
                timestampInfo.pop(0)
            else:
                timestampString = "No timestamp"
            
            print(f"'{word}' has {count} occurrences, First timestamp: {timestampString}", file=f)
    else:
        print("No words were found", file=f)
                     