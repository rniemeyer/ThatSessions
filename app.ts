/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/express/express.d.ts" />

import express = require('express');
import request = require('request');
var app = express();

app.use(express.static("public")); //serve statics from /public

app.post("/getSessions", (req, res) => {
  request("https://www.thatconference.com/api3/Session/GetAcceptedSessionsByTimeslot", (error, response, body) => {
    if (!error && response.statusCode == 200) {
      res.json(JSON.parse(body));
    }
    else {
      res.status(response.statusCode).json(error);
    }
  });
});

var server = app.listen(process.env.PORT || 3000, () => {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});
