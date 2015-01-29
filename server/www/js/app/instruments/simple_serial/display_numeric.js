/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * The right side display
 * 
 * Our model is the settings object.
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        utils    = require('app/utils'),
        template = require('js/tpl/instruments/SimpleSerialNumView.js');
                    
    return Backbone.View.extend({

        initialize:function (options) {
            linkManager.on('input', this.showInput, this);
        },

        events: {
            "change #serial-display": "update_parser",
        },

        render:function () {
            var self = this;
            console.log('Main render of Simple Serial numeric view');
            $(this.el).html(template());
            return this;
        },
        
        update_parser: function(e) {
            console.log("Update parser");
            instrumentManager.liveViewRef().update_parser(e);
        },

        onClose: function() {
            console.log("Simple Serial numeric view closing...");
            linkManager.off('input', this.showInput,this);
        },

        showInput: function(data) {
        },


    });
});