import express from 'express';  
import cors from 'cors';

import multer from 'multer';  
import mongoose from 'mongoose';

import path from 'path';  

import jwt from 'jsonwebtoken' 

//no need for this in .js
//in .js the import is replaced with "const lib = require("lib")"
import { fileURLToPath } from 'url'; // Import the fileURLToPath function  
import { dirname } from 'path'; // Import dirname  
// Get the current directory  
const __filename = fileURLToPath(import.meta.url);  
const __dirname = dirname(__filename)


const app = express();  
const PORT = process.env.PORT || 3000;  
app.listen(PORT, () => console.log(`Running on port ${PORT}`));  

app.use(express.json());  
app.use(cors());  
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup multer for file uploads//////////// 
const storage = multer.diskStorage({  
    destination: (req, file, cb) => {  
        cb(null, 'uploads/'); // directory to save the uploaded files  
    },  
    filename: (req, file, cb) => {  
        cb(null, file.originalname); // retain the original file name  
    },  
});  
const upload = multer({ storage });  

mongoose.connect("mongodb+srv://galbador:13841384@cluster0.zmxjift.mongodb.net/").then(() => console.log("Connected to Database"));  
const msgSchema = new mongoose.Schema({  
    senderId: { type: String, required: true },  
    recipientId: { type: String, required: true },  
    content: { type: String},  
    mediaUrl: { type: String },  
    timeStamp: { type: Date, default: Date.now },  
});
const userSchema = new mongoose.Schema({    
    username: { type: String, required: true, unique:true },  
    password: { type: String, required: true }, 
    token:{type:String},
    contacts:{type:Array}
});   
const userDatabase = mongoose.model("users",userSchema);
const msgDatabase = mongoose.model("msg", msgSchema);  


// Getting the messages(token,recipientId)
app.post("/getmsgs", async (req, res) => {  
    try {  
        const token = req.body.token;
        jwt.verify(token,'secret',async(err,decoded)=>{
            if(err){
                return res.status(404).send(err);
            }
            const user = await userDatabase.findOne({"token":token});
            const user2 = await userDatabase.findOne({"username":req.body.recipientId});
            if(!user2){
                return res.sendStatus(404);
            }
            const msgs = await msgDatabase.find({ "senderId": user.username, "recipientId": req.body.recipientId });
            const msgs2 = await msgDatabase.find({"senderId":req.body.recipientId,"recipientId":user.username})
            return res.json([...msgs,...msgs2]);  
        })

    } catch (err) {  
        res.status(404).send(err);  
    }  
});  

// Adding new message(token,recipientId,content,media)
// 'media' is the key that the file should be sent in  
app.post("/addmsgs", upload.single("media"), async (req, res) => {  
    try {
        const token = req.body.token;
        jwt.verify(token,'secret',async(err,decoded)=>{
            if(err){
                return res.send(err)
            }
            const user = await userDatabase.findOne({"token":token});
            const user2 = await userDatabase.findOne({"username":req.body.recipientId});
            if(!user2){
                return res.sendStatus(404);
            }
            const newMsg = new msgDatabase({  
                senderId: user.username,
                recipientId: req.body.recipientId,  
                content: req.body.content,  
                mediaUrl: req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null
            });  
            await newMsg.save();
            
            if(!user.contacts.includes(req.body.recipientId)){
                await userDatabase.updateOne({"token":token},{$set:{contacts:[...user.contacts,req.body.recipientId]}})
            }
            return res.sendStatus(200); 
        })

    } catch (err) {  
        return res.send(err);  
    }  
});

//(username,password)
app.post('/signin', async(req,res)=>{
    const newUser = new userDatabase(req.body);
    await newUser.save();
    res.sendStatus(200);
})

//(username,password)
app.post("/login", async(req,res)=>{
    const user = await userDatabase.findOne({"username":req.body.username,"password":req.body.password});
    if(user){
        const token = jwt.sign({userId:user._id},'secret',{expiresIn:"1h"});

        await userDatabase.updateOne({"username":req.body.username,"password":req.body.password},{$set:{"token":token}})
        return res.send({
            "token":token,
            "username":req.body.username,
            "contacts":user.contacts
        });
    }
    return res.send("fail");
})