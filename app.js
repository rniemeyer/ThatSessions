/// <reference path="typings/node/node.d.ts" />
/// <reference path="typings/express/express.d.ts" />
"use strict";
var express = require('express');
var request = require('request');
var app = express();
app.use(express.static("public")); //serve statics from /public
app.post("/getSessions", function (req, res) {
    request("https://www.thatconference.com/api3/Session/GetAcceptedSessionsByTimeslot", function (error, response, body) {
        if (!error && response.statusCode == 200) {
            res.json(JSON.parse(body));
        }
        else {
            res.status(response.statusCode).json(error);
        }
    });
});
var server = app.listen(process.env.PORT || 8080, function () {
    var host = server.address().address;
    var port = server.address().port;
    console.log('Example app listening at http://%s:%s', host, port);
});
//# sourceMappingURL=app.js.map