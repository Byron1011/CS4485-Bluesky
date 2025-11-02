# mini server which will be used to label raw posts from bluesky.

from flask import Flask, request, jsonify
import spacy
import time
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

app = Flask(__name__)


# Load SpaCy model, figures out what part of the text is about a location
ner_model = spacy.load("en_core_web_sm")

# Geocode with Nominatim, maps names of locations to their coordinates
geolocator = Nominatim(user_agent="geo_demo", timeout=100)

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

if __name__ == "__main__":
    app.run(port=5001, debug=False) # debug allows server to reload on file edits