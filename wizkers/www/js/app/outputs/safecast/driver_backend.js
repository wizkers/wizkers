/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 *
 * In-Browser implementation for Chrome and Cordova runmodes
 *
 * @author Edouard Lafargue, ed@lafargue.name
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

        var safecast_host = 'dev.safecast.org';
        if (instance == 'production') {
            safecast_host = 'api.safecast.org';
        } else if (instance == 'ttserve') {
            safecast_host = 'tt.safecast.org';
        }

        // Prepare the post options:
        post_options = {
            host: safecast_host,
            port: 80,
            method: 'POST',
            path: (instance == 'ttserve') ? '/scripts/index.php' : '/measurements.json',
            headers: {
            'X-Datalogger': 'wizkers.io Safecast plugin',
            'Content-Type': 'application/json',
            }
        };

        post_options.path = post_options.path + '?api_key=' + settings.apikey
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


    this.sendData = function(data, isAlarm) {
        var self = this;
        console.log("[Safecast Output plugin] Send data to Safecast");

        // Step one: prepare the structure
        var unit = this.resolveMapping("unit",data);
        var radiation =  this.resolveMapping("radiation",data);
        var lat =  this.resolveMapping("latitude",data);
        var lon =  this.resolveMapping("longitude",data);
        var devid = this.resolveMapping("device_id", data);
        var height = this.resolveMapping("height", data);

        // If any of those are empty, abort:
        if (unit == undefined || radiation == undefined || lat == undefined || lon == undefined) {
            console.log("[Safecast Output]  Data error, some required fields are empty");
            output_ref.save({'lastmessage': 'Missing required fields in the data'});
            return;
        }

        // Only keep three decimals on Radiation, more does not make sense
        radiation = parseFloat(radiation).toFixed(3);

        var post_obj = {
            'longitude': lon,
            'latitude': lat,
            'value': radiation,
            'unit': unit,
            'captured_at': new Date().toISOString(),
            'devicetype_id': 'Wizkers V1'
        }

        // Add optional fields if they are there:
        if (devid != undefined)
            post_obj['device_id'] = devid;

        if (height != undefined)
            post_obj['height'] = height;

        //var post_data = httprequest.stringify(post_obj);
        var post_data = JSON.stringify(post_obj);

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
