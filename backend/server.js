import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import  path from "path";
import { fileURLToPath } from "url";

dotenv.config();
import { generateHandler } from "./controllers/workFlowGenerate.controller.js";
import {userAuth} from "./controllers/userAuthentication.controller.js";
const app = express();
app.use(cors());
app.use(express.json());


app.post("/api/generate", generateHandler);
app.post("/api/user",userAuth);
app.post("/api/validate",userAuth);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "./public")));

app.use("/option", (req, res) => {
  res.sendFile(path.join(__dirname, `./public/option.html`));
});

app.use("/close", (req, res) => {
  res.sendFile(path.join(__dirname, `./public/close.html`));
});

app.use("/", (req, res) => {
  res.sendFile(path.join(__dirname, `./public/index.html`));
});

app.use("/*splat", (req, res) => {
  res.sendFile(path.join(__dirname, `./public/dist/bundle.js`));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`AI proxy server running on port ${PORT}`));
