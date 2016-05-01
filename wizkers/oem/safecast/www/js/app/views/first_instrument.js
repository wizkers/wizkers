/**
 * (c) 2016 Edouard Lafargue, ed@lafargue.name
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
define(function(require) {
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        template = require('js/tpl/FirstInstrument.js');

    return Backbone.View.extend({

        initialize:function () {
        },

        events: {
        },

        onClose: function() {
            console.log("[Safecast] First instrument view...");
        },
        
        setApiKey: function(k) {
            this.apiKey = k;
        },

        render:function () {
            var self = this;
            this.$el.html(template());
            
            require(['app/models/instrument'], function (model) {
                var instrument = new model.Instrument();
                instrumentManager.getConnectionSettingsFor("bgeigie", {
                    model: instrument
                }, function (view) {
                    self.$('#portsettings').html(view.el);
                    view.render();
                    // Keep a reference to tell the view to close
                    // when we close this view
                    self.connectionView = view;
                });
            });
            
            return this;
        },

    });
});