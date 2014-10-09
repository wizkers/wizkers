/**
 *
 * In-Browser implementation for Chrome and Cordova runmodes
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 *
 *  Exposes three methods:
 *
 *  - setup
 *  - sendData
 *  - resolveMapping
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
            'X-Datalogger': 'wizkers.io Safecast plugin'
            'Content-Type': 'application/x-www-form-urlencoded',
            }
        };
        console.log(post_options);
        
    };
    
    // The output manager needs access to this to compute alarm conditions
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
        var self = this;
        console.log("[Safecast Output plugin] Send data to Safecast");
        
        // Step one: prepare the structure
        var unit = this.resolveMapping("unit",data);
        var radiation =  this.resolveMapping("radiation",data);
        var lat =  this.resolveMapping("latitude",data);
        var lon =  this.resolveMapping("longitude",data);
        var devid = this.resolveMapping("device_id", data);
        
        // If any of those are empty, abort:
        if (unit == undefined || radiation == undefined || lat == undefined || lon == undefined) {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            output_ref.save({'lastmessage': 'Missing required fields in the data'});
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

        var post_data = httprequest.stringify(post_obj);
        
        output_ref.save({'last': new Date().getTime()});
        var post_request = httprequest.request(post_options, function(res) {
            var err = true;
            console.log("[Safecast Output Plugin] API Request result");
            // this is the xmlhttprequest
            switch (this.status) {
                    case 0:  // Cannot connect
                        output_ref.set('lastmessage', 'Cannot connect to Safecast');
                        break;
                    case 201: // success
                        output_ref.set('lastsuccess', res.timeStamp);
                        output_ref.set('lastmessage', this.statusText);
                        err = false;
                        break;
                    default:
                        output_ref.set('lastmessage', this.statusText);
                        break;
            }
            self.trigger('outputTriggered', { 'name': 'safecast', 'error': err, 'message': this.statusText } );
            output_ref.save();
        });
        console.log(post_data);
        post_request.send(post_data);
        
    };
            
    }
    
    _.extend(Output.prototype, Backbone.Events);
    
    return Output;

});