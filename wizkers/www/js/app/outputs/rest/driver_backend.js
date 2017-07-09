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
 */

define(function (require) {

    "use strict";

    var _ = require('underscore'),
        Backbone = require('backbone'),
        utils = require('app/utils'),
        httprequest = require('app/lib/httprequest');

    var matchTempl = function (str, args) {
        return str.replace(/<%=(.*?)%>/g, function (match, field) {
            // the != undefined test is necessary since args[field] can be == 0
            return (args[field] != undefined) ? args[field] : match;
        });
    }


    var decompUrl = function (str) {
        if (str == undefined)
            return false;
        // Straight from RFC 3986 Appendix B
        var decomp = str.match(/(([^:/?#]+):\/\/([^/?#]*))?(([^?#]*)(\?([^#]*))?(#(.*))?)/);
        return {
            proto: decomp[2],
            host: decomp[3],
            path: decomp[5],
            args: decomp[7],
            ref: decomp[9]
        }
    }

    var Output = function () {

        var mappings = null;
        var settings = null;
        var post_options = {};
        var regexpath = "";
        var regexargs = "";
        var output_ref = null;

        // The output manager needs access to this to compute alarm conditions
        this.resolveMapping = function (key, data) {
            var m = mappings[key];
            if (typeof m == 'undefined')
                return undefined;
            // Static mappings start with "__"
            if (m.indexOf("__") == 0)
                return m.substr(2);
            return utils.JSONflatten(data)[mappings[key]];
        };

        // Load the settings for this plugin
        this.setup = function (output) {
            console.log("[REST Output plugin] Setup a new instance");

            output_ref = output;
            mappings = output.get('mappings');
            settings = output.get('metadata');

            // Prepare the post options:
            post_options = {
                host: decompUrl(settings.resturl).host,
                port: 80,
                method: (settings.httprequest == "get") ? 'GET' : 'POST',
                // we don't set path here because it is templated
                headers: {
                    'X-Datalogger': 'wizkers.io REST plugin'
                }
            };
            if (settings.httprequest != "get")
                post_options['headers']['Content-Type'] = 'application/x-www-form-urlencoded';

            regexpath = decompUrl(settings.resturl).path;
            regexargs = decompUrl(settings.resturl).args;
        };

        this.sendData = function (data, isAlarm) {
            var self = this;
            console.log("[REST Output plugin] Send data");

            // Step one: prepare the structure
            var fields = {};
            for (var mapping in mappings) {
                fields[mapping] = self.resolveMapping(mapping, data);
            };

            post_options.path = matchTempl(regexpath, fields);
            var post_data = matchTempl(regexargs, fields);

            // If we do a GET, aggregate the path and post_data
            if (post_options.method == "GET") {
                post_options.path = post_options.path + '?' + post_data;
            }

            output_ref.save({
                'last': new Date().getTime()
            });
            var post_request = httprequest.request(post_options, function (res) {
                var err = true;
                console.log("[REST Output Plugin] REST Request result", this.status, this.statusText);
                // this is the xmlhttprequest
                switch (this.status) {
                case 0: // Cannot connect
                    output_ref.set('lastmessage', 'Cannot connect to host');
                    break;
                case 200:
                case 201: // success
                    output_ref.set('lastsuccess', res.timeStamp);
                    output_ref.set('lastmessage', this.statusText);
                    err = false;
                    break;
                default:
                    output_ref.set('lastmessage', this.statusText);
                    break;
                }
                self.trigger('outputTriggered', {
                    'name': 'rest',
                    'error': err,
                    'message': this.statusText
                });
                output_ref.save();
            });
            if (post_options.method == 'POST') {
                post_request.send(post_data);
            } else {
                post_request.send();
            }
        }
    }

    _.extend(Output.prototype, Backbone.Events);
    return Output;

});