import mongoose, { mongo } from 'mongoose';
import 'dotenv/config';
import { EventEmitter } from 'node:events';

export async function connect() {
    // get uri info for connecting to atlas from .env file
    console.log("connect");
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI not set!');
    }
    
    // connect to mongodb atlas
    await mongoose.connect(uri);

    // select db
    mongoose.connection.useDb('main');

    // on connect, log connection status
    mongoose.connection.on('connected', () => {
        console.log('Connected to MongoDB!');
    });

    // on an connection error, go ahead and log the errors information
    mongoose.connection.on('error', (err) => {
        console.error(`Mongoose connection error:\n${err.stack}`);
    });

    // upon disconnect, log connection status
    mongoose.connection.on('disconnected', () => {
        console.log('Disconnected from MongoDB!');
    });

    // upon opening of mongodb, execute this asyncronous function
    mongoose.connection.on('open', async () => {
        // store weather_accounts collection in memory
        const accountCollection = mongoose.connection.collection('soil_accounts');
        // watch for changes to "weather_accounts" collection
        const changeStream = accountCollection.watch();
        // upon a change to this collection, execute this function whilst passing the change into the function
        changeStream.on('change', (change) => {
            // if the change's operation type is "insert"
            if (change.operationType === 'insert') {
                // emit a "newApiKey" event
                console.log("newApiKey");
                newApiKeyEvent.emit('newApiKey', change.fullDocument._id);
            }
            // handle deletions
            if (change.operationType === 'delete') {
                // emit a "deleteApiKey" event
                console.log("deleteApiKey");
                newApiKeyEvent.emit('deleteApiKey', change.documentKey._id);
            }
        });
    });
}

// export an EventEmitter for ApiKeyEvents
export const newApiKeyEvent = new EventEmitter();