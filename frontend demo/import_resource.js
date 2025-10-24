// Use this program to parse a csv file and save each row as a Resource Document in our MongoDB


import Resource from "./resource_schema.js";

import mongoose from "mongoose";

import csv from "csv-parser";

import 'dotenv/config';

import fs from "fs";

// Connect to DB
await mongoose.connect(process.env.MONGO_URI);


const FILE_NAME = "us_hospital_locations.csv";

const FILE_LOCATION = "datasets/" + FILE_NAME;

const RESOURCE_TYPE = "hospital";

const results = [];
fs.createReadStream(FILE_LOCATION)
    .pipe(csv({ mapHeaders: ({ header, index }) => header.trim().toLowerCase() })) // make all headers lowercase in case they are wonky
    .on('data', (row) => {

        // DATASET SPECIFIC CHECKS
        if (row.status && row.status == "CLOSED") {
            return;
        }

        

        // Convert each row to a document
        const resource = new Resource({

            name: row.name,
            type: RESOURCE_TYPE,
            location: {
                type: "Point",
                coordinates: [row.longitude, row.latitude]
            },
            address: row.address,
            state: row.state,
            city: row.city

        }); // note resource not saved to DB yet

        // DATASET SPECIFIC

        if (row.website != "NOT AVAILABLE"){
            resource.website = row.website;
        }

        if (row.telephone != "NOT AVAILABLE"){
            resource.phone = row.telephone;
        }

        results.push(resource);
    })
    .on('end', async () => {

        console.log(results);
        console.log(`END OF CSV, CREATED ${results.length} documents`);
        //   await Shelter.insertMany(results);
        //   console.log("");
        await Resource.insertMany(results);
        mongoose.connection.close();

    });