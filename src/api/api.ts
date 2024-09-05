import bodyparser from "body-parser";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { connect } from "../db/connect.js";
import submitRstpRoute from "./routes/submitRstpRoute.js";

const app = express();
app.use(bodyparser.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: function (req) {
    return req.body.address;
  },
  handler: function (req, res) {
    console.log("Rate limit exceeded for " + req.body.address);
    res.status(429).send({
      message: "Too many requests, please try again later.",
      status: "ERROR",
    });
  },
});

app.use(limiter);
app.set("trust proxy", 1);

app.get("/", function (req, res) {
  res.status(403).send({
    message: "Please use the API as described in the documentation.",
  });
});

app.use(submitRstpRoute);

export async function startApi() {
  console.log("startApi")
  await connect();
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
}
