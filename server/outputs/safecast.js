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
    var post_options = {};
    
    // Load the settings for this plugin
    this.setup = function(meta, map) {
        
        console.log("[Safecast Output plugin] Setup a new instance");
        mappings = map;
        settings = meta;
        
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
        
        // If any of those are empty, abort:
        if (unit == '' || radiation == '' || lat == '' || lon == '') {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            console.log(data);
            return;
        }
        
        var post_data = querystring.stringify({
            'api_key' :  settings.apikey,
            'measurement[captured_at]': new Date().toISOString(),
            'measurement[unit]': unit,
            'measurement[value]': radiation,
            'measurement[latitude]': lat,
            'measurement[longitude]': lon
        });
        
        
        var post_request = http.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(data) {
                console.log("API Request result - " + data);
            });
        });
        
        
        console.log(post_data);
        post_request.write(post_data);
        post_request.end();
        
    };
            
};
