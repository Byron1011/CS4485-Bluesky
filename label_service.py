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
# this second model didnt actually end up working, gonna use a keyword based approach for now
#sev_classifier = pipeline("text-classification", model ="AliArshad/Severity_Predictor")

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
        # Deduplicate texts (preserving order)
        seen = {}
        unique_texts = []
        for t in texts:
            key = (t or "").strip()
            if key not in seen:
                seen[key] = None
                unique_texts.append(key)

        # Run model only on unique texts
        results = classifier(unique_texts, truncation=True)

        # Heuristic-based severity estimation keywords
        HIGH_SEVERITY = {
            "massive", "devastating", "catastrophic", "destroyed", "collapsed",
            "major", "deadly", "fatalities", "many dead", "thousands", "emergency",
            "disaster", "severe", "widespread", "explosion", "hurricane", "earthquake"
        }
        MODERATE_SEVERITY = {
            "damaged", "injured", "significant", "bad", "dangerous",
            "strong", "heavy", "serious", "impact", "evacuated", "evacuations"
        }
        LOW_SEVERITY = {
            "minor", "small", "contained", "under control",
            "low", "isolated", "light", "brief"
        }

        def estimate_severity(text):
            """Simple keyword-based severity estimator"""
            lower = text.lower()
            high_hits = sum(kw in lower for kw in HIGH_SEVERITY)
            mod_hits = sum(kw in lower for kw in MODERATE_SEVERITY)
            low_hits = sum(kw in lower for kw in LOW_SEVERITY)

            if high_hits >= 2 or (high_hits and mod_hits):
                return "severe"
            elif mod_hits >= 2 or (high_hits and not mod_hits):
                return "moderate"
            elif low_hits >= 1:
                return "low"
            else:
                return "unknown"

        # Normalize results into label/score pairs
        normalized = []
        for i, r in enumerate(results):
            if isinstance(r, list) and r:
                lab = r[0].get("label")
                sc = r[0].get("score")
            else:
                lab = r.get("label")
                sc = r.get("score")

            sev = "none"
            if lab.lower().startswith("disaster") or "label_1" in lab.lower():
                sev = estimate_severity(unique_texts[i])
                """
                sev_result = sev_classifier(unique_texts[i], truncation=True)[0]
                sev_label = sev_result["label"].lower()
                if "severe" in sev_label:
                    sev = "high"
                elif "non-severe" in sev_label:
                    sev = "low"
                """
            normalized.append((lab, sc, sev))

        # Assign results back to each unique text
        for i, t in enumerate(unique_texts):
            seen[t] = normalized[i]

        # Build aligned output (reusing cached predictions for duplicates)
        labels, scores, severities = [], [], []
        for t in texts:
            key = (t or "").strip()
            lab, sc, sev = seen.get(key, ("LABEL_0", 0.0, "none"))
            labels.append(lab)
            scores.append(sc)
            severities.append(sev)

        print(f"Classified {len(unique_texts)} unique texts out of {len(texts)} total.")
        return jsonify({"labels": labels, "scores": scores, "severities": severities})

    except Exception as e:
        print("Error during disaster classification:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5001, debug=False) # debug allows server to reload on file edits