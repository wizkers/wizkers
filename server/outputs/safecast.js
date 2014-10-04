/**
 * A SafeCast API output plugin
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

var mongoose = require('mongoose'),
    querystring = require('querystring'),
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
        mappings = output.maping;
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
            'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        console.log(post_options);
        
    };
    
    var resolveMapping = function(key,data) {
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
        var unit = resolveMapping("unit",data);
        var radiation =  resolveMapping("radiation",data);
        var lat =  resolveMapping("latitude",data);
        var lon =  resolveMapping("longitude",data);
        var devid = resolveMapping("device_id", data);
        
        // If any of those are empty, abort:
        if (unit == undefined || radiation == undefined || lat == undefined || lon == undefined) {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            console.log(data);
            output_ref.lastmessage = 'Missing required fields in the data';
            output_ref.save();
            return;
        }
        
        var post_data = querystring.stringify({
            'api_key' :  settings.apikey,
            'measurement[captured_at]': new Date().toISOString(),
            'measurement[unit]': unit,
            'measurement[value]': radiation,
            'measurement[latitude]': lat,
            'measurement[longitude]': lon,
        });
        
        // Add optional fields if they are there:
        if (devid != undefined)
            post_data['measurement[device_id]'] = devid;
        
        post_options.headers['Content-Length'] = post_data.length;
        
        var post_request = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(data) {
                console.log("API Request result");
                console.log(data);
                // output_ref.lastmessage = ;
                output_ref.save();
            });
        });
        
        console.log("[Safecast Output] Sending data to " + post_options.host);
        
        console.log(post_data);
        post_request.write(post_data);
        post_request.end();
        
    };
            
};
