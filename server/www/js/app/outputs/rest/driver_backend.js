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

    var templ = function(str, args) {
        return str.replace(/<%=(.*?)%>/g, function(match, field) {
            return args[field] || match;
        });
    }

    var Output = function() {

        // Load the settings for this plugin
        this.setup = function(output) {
        console.log("[REST Output plugin] Setup a new instance");
        };

        this.sendData = function(data) {
        }

    }
    
    _.extend(Output.prototype, Backbone.Events);
    return Output;

});