/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var AssistantV1 = require('watson-developer-cloud/assistant/v1'); // watson sdk
const ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
var cfenv = require("cfenv");

////const vcapServices = require('./config/vcap_services');

var app = express();

let workspaceID = '';

//hashims repo

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

let mydb, cloudant;
var vendor; 
var dbName = 'mydb';

var insertOne = {};
var getAll = {};



app.get("/api/hospitals/all", function (request, response) {

    var names = [];  
     
      var names = [];  
      mydb.list({ include_docs: true }, function(err, body) {
        if (!err) {
          body.rows.forEach(function(row) {
            if(row.doc)
              names.push(row.doc);
          });
          response.json(names);
        }
      });

});

var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['compose-for-mongodb'] || appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/)) {
  // Load the MongoDB library.
  var MongoClient = require('mongodb').MongoClient;

  dbName = 'mydb';

  // Initialize database with credentials
  if (appEnv.services['compose-for-mongodb']) {
    MongoClient.connect(appEnv.services['compose-for-mongodb'][0].credentials.uri, null, function(err, db) {
      if (err) {
        console.log(err);
      } else {
        mydb = db.db(dbName);
        console.log("Created database: " + dbName);
      }
    });
  } else {
    // user-provided service with 'mongodb' in its name
    MongoClient.connect(appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/).credentials.uri, null,
      function(err, db) {
        if (err) {
          console.log(err);
        } else {
          mydb = db.db(dbName);
          console.log("Created database: " + dbName);
        }
      }
    );
  }

  vendor = 'mongodb';
} else if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)) {
  // Load the Cloudant library.
  var Cloudant = require('@cloudant/cloudant');

  // Initialize database with credentials
  if (appEnv.services['cloudantNoSQLDB']) {
    // CF service named 'cloudantNoSQLDB'
    cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
  } else {
     // user-provided service with 'cloudant' in its name
     cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
  }
} else if (process.env.CLOUDANT_URL){
  cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if(cloudant) {
  //database name
  dbName = 'mydb';

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if(!err) //err if database doesn't already exists
      console.log("Created database: " + dbName);
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);

  vendor = 'cloudant';
}

app.post("/hospitals", function (request, response) {
 var email = request.body.InputEmail;
 var hospital = request.body.InputHospitalName;
 var image = request.body.InputHospitalImage;
 var phone = request.body.InputPhoneNumber;
 var staff = request.body.InputMedicalStaffRequired;
 var title = request.body.InputTitle;
 var desc = request.body.InputDescription;

 var doc = 
 { 
   "Email" : email,
   "Hospital" : hospital,
   "Image" : image,
   "Phone" : phone,
   "Staff" : staff,
   "Title" : title,
   "Description" : desc
 };

 if(!mydb) {
   console.log("No database.");
   response.send(doc);
   return;
 }
 insertOne[vendor](doc, response);
});

insertOne.cloudant = function(doc, response) {
  mydb.insert(doc, function(err, body, header) {
    if (err) {
      console.log('[mydb.insert] ', err.message);
      response.send("Error");
      return;
    }
    doc._id = body.id;
    response.redirect('/')
    //response.json(doc);
  });
}

getAll.cloudant = function(response) {
  var names = [];  
  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if(row.doc.name)
          names.push(row.doc.name);
      });
      response.json(names);
    }
  });
  //return names;
}




//hashims repo




// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder

//app.all('/api/secure/*', [require('./middlewares/validateRequest')]);

// Create the service wrapper

var assistant = new AssistantV1({
  version: '2018-07-10',
  // version: '2019-02-28',
  headers: {
    'X-Watson-Learning-Opt-Out': true
  }
});

const toneAnalyzer = new ToneAnalyzerV3({
  version: '2017-09-21',
  headers: {
    'X-Watson-Learning-Opt-Out': true
  }
});


// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  workspaceID = process.env.DANDS_WORKSPACE_ID;
  console.log('workspace ID: ' + workspaceID);
  if (!workspaceID) {
    return res.json({
      output: {
        text: [
          'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable.'
        ]
      }
    });
  }

  let context = {};
  if (req.body.context) {
    context = req.body.context;
  }
  context.tone_anger_threshold = 0.6;
  context.tone_sadness_threshold = 0.5;
  if (req.body.input && req.body.input.text) {
    const queryInput = JSON.stringify(req.body.input.text);

    const toneParams = {
      tone_input: { text: queryInput },
      content_type: 'application/json'
    };
    toneAnalyzer.tone(toneParams, function(err, tone) {
      let toneAngerScore = 0;
      let toneSadnessScore = 0;
      if (err) {
        console.log('Error occurred while invoking Tone analyzer. ::', err);
      } else {
        console.log(JSON.stringify(tone, null, 2));
        const emotionTones = tone.document_tone.tones;

        const len = emotionTones.length;
        for (let i = 0; i < len; i++) {
          if (emotionTones[i].tone_id === 'anger') {
            console.log('Input = ', queryInput);
            console.log(
              'emotion_anger score = ',
              'Emotion_anger',
              emotionTones[i].score
            );
            toneAngerScore = emotionTones[i].score;
            break;
          } else if (emotionTones[i].tone_id === 'sadness') {
            console.log('Input = ', queryInput);
            console.log(
              'esadness_anger score = ',
              'Sadness_anger',
              emotionTones[i].score
            );
            toneSadnessScore = emotionTones[i].score;
            break;
          }
        }
      }

      context.tone_anger_score = toneAngerScore;
      context.tone_sadness_score = toneSadnessScore;

      var payload = {
        workspace_id: workspaceID,
        context: context || {},
        input: req.body.input || {}
      };

      // Send the input to the assistant service
      assistant.message(payload, function(err, data) {
        if (err) {
          return res.status(err.code || 500).json(err);
        }

        // This is a fix for now, as since Assistant version 2018-07-10,
        // output text can now be in output.generic.text
        var output = data.output;
        if (output.text.length === 0 && output.hasOwnProperty('generic')) {
          var generic = output.generic;

          if (Array.isArray(generic)) {
            // Loop through generic and add all text to data.output.text.
            // If there are multiple responses, this will add all of them
            // to the response.
            for (var i = 0; i < generic.length; i++) {
              if (generic[i].hasOwnProperty('text')) {
                data.output.text.push(generic[i].text);
              } else if (generic[i].hasOwnProperty('title')) {
                data.output.text.push(generic[i].title);
              }
            }
          }
        }

        return res.json(updateMessage(payload, data));
      });
    });
  } else {
    var payload = {
      workspace_id: workspaceID,
      context: req.body.context || {},
      input: req.body.input || {}
    };

    // Send the input to the assistant service
    assistant.message(payload, function(err, data) {
      if (err) {
        return res.status(err.code || 500).json(err);
      }

      // This is a fix for now, as since Assistant version 2018-07-10,
      // output text can now be in output.generic.text
      var output = data.output;
      if (output.text.length === 0 && output.hasOwnProperty('generic')) {
        var generic = output.generic;

        if (Array.isArray(generic)) {
          // Loop through generic and add all text to data.output.text.
          // If there are multiple responses, this will add all of them
          // to the response.
          for (var i = 0; i < generic.length; i++) {
            if (generic[i].hasOwnProperty('text')) {
              data.output.text.push(generic[i].text);
            } else if (generic[i].hasOwnProperty('title')) {
              data.output.text.push(generic[i].title);
            }
          }
        }
      }

      return res.json(updateMessage(payload, data));
    });
  }
});



/**
 * Updates the response text using the intent confidence
 * @param  {Object} input The request to the Assistant service
 * @param  {Object} response The response from the Assistant service
 * @return {Object}          The response with the updated message
 */
function updateMessage(input, response) {
  var responseText = null;
  if (!response.output) {
    response.output = {};
  } else {
    return response;
  }
  if (response.intents && response.intents[0]) {
    var intent = response.intents[0];
    // Depending on the confidence of the response the app can return different messages.
    // The confidence will vary depending on how well the system is trained. The service will always try to assign
    // a class/intent to the input. If the confidence is low, then it suggests the service is unsure of the
    // user's intent . In these cases it is usually best to return a disambiguation message
    // ('I did not understand your intent, please rephrase your question', etc..)
    if (intent.confidence >= 0.75) {
      responseText = 'I understood your intent was ' + intent.intent;
    } else if (intent.confidence >= 0.5) {
      responseText = 'I think your intent was ' + intent.intent;
    } else {
      responseText = 'I did not understand your intent';
    }
  }
  response.output.text = responseText;
  return response;
}

module.exports = app;
