import { startApi } from "./api/api.js";

const startApp = async () => {
    console.log("startApp")
    await startApi();
}

startApp();