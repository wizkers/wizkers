/**
 *
 * In-Browser implementation for Chrome and Cordova runmodes
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    
    "use strict";
    
    var _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        httprequest = require('app/lib/httprequest');

    var Output = function() {

    var mappings = null;
    var settings = null;
    var post_options = {};
    var output_ref = null;
    
    // Load the settings for this plugin
    this.setup = function(output) {
        
        console.log("[Safecast Output plugin] Setup a new instance");
        output_ref = output;
        mappings = output.get('mappings');
        settings = output.get('metadata');
        
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
        console.log("[Safecast Output plugin] Send data to Safecast");
        
        // Step one: prepare the structure
        var unit = resolveMapping("unit",data);
        var radiation =  resolveMapping("radiation",data);
        var lat =  resolveMapping("latitude",data);
        var lon =  resolveMapping("longitude",data);
        var devid = resolveMapping("device_id", data);
        
        // If any of those are empty, abort:
        if (unit == undefined || radiation == undefined || lat == undefined || lon == undefined) {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            output_ref.save({'lastmessage': 'Missing required fields in the data'});
            return;
        }
        
        var post_data = httprequest.stringify({
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
        
        output_ref.save({'last': new Date().getTime()});
        var post_request = httprequest.request(post_options, function(res) {
            console.log("[Safecast Output Plugin] API Request result");
            if (res.target.status == 201) {
                output_ref.set('lastsuccess', res.timeStamp);
            }
            output_ref.set('lastmessage', res.target.statusText);
            output_ref.save();
        });
        
        // console.log("[Safecast Output] Sending data to " + post_options.host);
        
        console.log(post_data);
        post_request.send(post_data);
        
    };
            
    }
    
    _.extend(Output.prototype, Backbone.Events);
    
    return Output;

});