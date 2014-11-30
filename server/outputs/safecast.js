/**
 * A SafeCast API output plugin
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var querystring = require('querystring'),
    utils = require('../utils.js'),
    http = require('http');

module.exports = function safecast() {
    
    var mappings = null;
    var settings = null;
    var output_ref = null;
    var post_options = {};
    
    // Load the settings for this plugin
    this.setup = function(output) {
        
        console.log("[Safecast Output plugin] Setup a new instance");
        mappings = output.mappings;
        settings = output.metadata;
        output_ref = output;
        
        var instance = settings.instance; // can be "production" or "dev"
        
        // Prepare the post options:
        post_options = {
            host: (instance == "production") ? "api.safecast.org" : "dev.safecast.org",
            port: 80,
            method: 'POST',
            path: '/measurements.json',
            headers: {
                'X-Datalogger': 'wizkers.io server-mode Safecast plugin',
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        console.log(post_options);
    };
    
    this.resolveMapping = function(key,data) {
        var m = mappings[key];
        if (typeof m == 'undefined')
            return undefined;
        // Static mappings start with "__"
        if (m.indexOf("__")==0)
            return m.substr(2);
        return utils.JSONflatten(data)[mappings[key]];
    };
    
    
    this.sendData = function(data) {
        console.log("[Safecast Output plugin] ToDo: send data to Safecast");
        
        // Step one: prepare the structure
        var unit = this.resolveMapping("unit",data);
        var radiation =  this.resolveMapping("radiation",data);
        var lat =  this.resolveMapping("latitude",data);
        var lon =  this.resolveMapping("longitude",data);
        var devid = this.resolveMapping("device_id", data);
        
        // If any of those are empty, abort:
        if (unit == undefined || radiation == undefined || lat == undefined || lon == undefined) {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            console.log(data);
            output_ref.lastmessage = 'Missing required fields in the data';
            dbs.outputs.get(output_ref._id, function(err,result) {
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function(err,result) {
                });
            });
            return;
        }
        
        // Only keep three decimals on Radiation, more does not make sense
        radiation = parseFloat(radiation).toFixed(3);
        
        var post_obj = {
            'api_key' :  settings.apikey,
            'measurement[captured_at]': new Date().toISOString(),
            'measurement[unit]': unit,
            'measurement[value]': radiation,
            'measurement[latitude]': lat,
            'measurement[longitude]': lon,
        };

        // Add optional fields if they are there:
        if (devid != undefined)
            post_obj['measurement[device_id]'] = devid;

        var post_data = querystring.stringify(post_obj);
        
        post_options.headers['Content-Length'] = post_data.length;
        
        var post_request = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            if (res.statusCode == 201 || res.statusCode == 200) {
                output_ref.lastsuccess = new Date().getTime();
            }
            res.on('data', function(data) {
                console.log("API Request result");
                console.log(data);
                output_ref.lastmessage = data;
                dbs.outputs.get(output_ref._id, function(err,result) {
                    output_ref._rev = result._rev;
                    dbs.outputs.put(output_ref, function(err,result) {
                });
            });
            });
        });
        
        post_request.on('error', function(err) {
            output_ref.lastmessage = 'Error:' + err;err
            dbs.outputs.get(output_ref._id, function(err,result) {
                output_ref._rev = result._rev;
                dbs.outputs.put(output_ref, function(err,result) {
                });
            });
        });

        
        console.log("[Safecast Output] Sending data to " + post_options.host);
        output_ref.last = new Date().getTime();
        dbs.outputs.get(output_ref._id, function(err,result) {
            output_ref._rev = result._rev;
            dbs.outputs.put(output_ref, function(err,result) {
            });
        });
        console.log(post_data);
        post_request.write(post_data);
        post_request.end();
        
    };
            
};
