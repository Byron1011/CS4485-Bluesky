# mini server which will be used to label raw posts from bluesky.

from flask import Flask, request, jsonify
import spacy
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from transformers import pipeline

app = Flask(__name__)


# Load SpaCy model, figures out what part of the text is about a location
ner_model = spacy.load("en_core_web_sm")

# Geocode with Nominatim, maps names of locations to their coordinates
geolocator = Nominatim(user_agent="geo_demo", timeout=100)

classifier = pipeline("text-classification", model ="elam2909/bert-disaster-classifier")
# this second model is EXTREMELY sensitive, so it needs to be combined with the keyword approach to properly work
sev_classifier = pipeline("text-classification", model ="AliArshad/Severity_Predictor")

@app.route("/ner", methods=["POST"])
def ner():
    
    
    data = request.get_json()
    raw_posts = data.get("raw_posts", [])


    for i, post in enumerate(raw_posts):
        text = post.get("text")

        doc = ner_model(text)

        locations = [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]

        print("=" * 50)
        print(f"Text {i}: {text}")

        print("Locations found:", locations)

        post_coordinates = []

        for loc in locations:
            
            geo = None

            RETRIES = 3
            for attempt in range(RETRIES):
                try:
                    geo = geolocator.geocode(loc)
                    if geo is not None:
                        break
                except (GeocoderTimedOut, GeocoderServiceError) as e:
                    print(f"Geocoding error for '{loc}' (attempt {attempt+1}): {e}")
                time.sleep(1)

            
            if geo:
                print(f"{loc} → ({geo.latitude}, {geo.longitude})")
                post_coordinates.append([geo.latitude, geo.longitude])
            else:
                print("No location found in text")
        post["coordinates"] = post_coordinates


    return jsonify({  "posts": raw_posts })

# hugging face api implementation
@app.route("/predict_disaster", methods=["POST"])
def predict_disaster():
    """
    Expects JSON: {"texts": ["text1", "text2", ...]}
    Returns: {"labels": [...], "scores": [...]}
    Deduplicates identical texts so they are not reclassified.
    """
    data = request.get_json(force=True)
    texts = data.get("texts", [])
    if not isinstance(texts, list):
        return jsonify({"error": "texts must be a list"}), 400

    try:
        # deduplicates texts
        seen = {}
        unique_texts = []
        for t in texts:
            key = (t or "").strip()
            if key not in seen:
                seen[key] = None
                unique_texts.append(key)

        # Disaster classification, runs only on unique posts
        disaster_results = classifier(unique_texts, truncation=True)
        disaster_labels = []
        disaster_scores = []
        for r in disaster_results:
            if isinstance(r, list) and r:
                lab = r[0].get("label", "").lower()
                sc = r[0].get("score", 0.0)
            else:
                lab = r.get("label", "").lower()
                sc = r.get("score", 0.0)
            disaster_labels.append(lab)
            disaster_scores.append(sc)

        # Severity binary classifier
        sev_results = sev_classifier(unique_texts, truncation=True)
        sev_labels = []
        sev_scores = []
        for r in sev_results:
            if isinstance(r, list) and r:
                lab = r[0].get("label", "").lower()
                sc = r[0].get("score", 0.0)
            else:
                lab = r.get("label", "").lower()
                sc = r.get("score", 0.0)
            sev_labels.append(lab)
            sev_scores.append(sc)

        # Keyword severity mapping, acts as a second layer of filtering, can add more keywords later
        HIGH = {"massive","devastating","catastrophic","destroyed","collapsed","major","deadly","fatalities","many dead","thousands","emergency","severe",
                "widespread","explosion","hurricane","earthquake", "calamity", "cataclysm"}
        MOD = {"damaged","injured","significant","bad","dangerous","strong","heavy","serious","impact","evacuated","evacuations", "disaster", "emergency", "moderate"}
        LOW = {"minor","small","contained","under control","low","isolated","light","brief", "mini", "miniature", "tiny"}

        def keyword_counts(text):
            t = (text or "").lower()
            hi = sum(1 for k in HIGH if k in t)
            mo = sum(1 for k in MOD if k in t)
            lo = sum(1 for k in LOW if k in t)
            return hi, mo, lo

        # severity classification
        final_severities = []
        for i, txt in enumerate(unique_texts):
            dlab = disaster_labels[i]

            # If it's not a disaster, leave severity empty
            if not ("label_1" in dlab or "disaster" in dlab):
                final_severities.append("none")
                continue

            sev_lab = sev_labels[i]
            sev_score = sev_scores[i]
            hi, mo, lo = keyword_counts(txt)

            # model decides if severity FLOOR is low or moderate, due to the sensitivity of the model
            if sev_lab == "label_1":   # model says severe
                baseline = "moderate"
            else:                      # model says non-severe
                baseline = "low"

            # uses the keywords as a second layer of filtering
            # strong indicators → severe
            if hi >= 1:
                severity = "severe"
            # one moderate → moderate
            elif mo >= 1:
                severity = "moderate"
            # weak evidence → low
            elif lo >= 1:
                severity = "low"
            else:
                severity = baseline   # fall back to model floor

            final_severities.append(severity)


        # Save results into seen
        for i, txt in enumerate(unique_texts):
            seen[txt] = (disaster_labels[i], disaster_scores[i], final_severities[i])

        # Map back to original
        out_labels, out_scores, out_sev = [], [], []
        for t in texts:
            key = (t or "").strip()
            lbl, sc, sev = seen.get(key, ("label_0", 0.0, "none"))
            out_labels.append(lbl)
            out_scores.append(sc)
            out_sev.append(sev)

        # debug stuff, uncomment if you need to see the labels + the scores for the severities and the final classification for the posts
        #print("DEBUG: sev_labels, sev_scores:", list(zip(sev_labels, sev_scores))[:10])
        #print("DEBUG: final severity:", out_sev[:10])

        return jsonify({"labels": out_labels, "scores": out_scores, "severities": out_sev})

    except Exception as e:
        print("Error in predict_disaster:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5001, debug=False) # debug allows server to reload on file edits