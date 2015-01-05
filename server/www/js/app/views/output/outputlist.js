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

/**
 * Defines a list of outputs, arranged as a series of 'cards'
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function(require) {
    
    "use strict";
    
    var $       = require('jquery'),
        _       = require('underscore'),
        Backbone = require('backbone'),
        Paginator = require('app/views/paginator'),
        template = require('js/tpl/OutputListItemView.js');
    
        var OutputListItemView = Backbone.View.extend({

            tagName: "div",
            className: "col-md-3 col-sm-2",

            initialize: function () {
            },

            render: function () {
                $(this.el).html(template(this.model.toJSON()));
                this.updateButtonStatus(this.model.get('enabled'));
                return this;
            },

            events: {
                "click .select" : "toggleOutput",
                "click .edit": "editOutput",
            },

            editOutput: function(event) {
                var url = event.target.href.substr(event.target.baseURI.length);
                router.navigate(url, {trigger: true});
                event.stopPropagation();
            },

            toggleOutput: function(event) {
                var self = this;
                var en = this.model.get('enabled');
                en = !en;
                this.model.save({enabled: en}, {
                    success: function() {
                        self.updateButtonStatus(en);
                        outputManager.reconnectOutputs();
                    }
                });
                
            },
            
            updateButtonStatus: function(en) {
                console.log('Output status: ' + en);
                if (en) {
                    $(".enStatus", this.el).addClass('btn-success').removeClass('btn-danger');
                    $(".enStatus", this.el).html("Enabled");
                    // Tell the output manager we got enabled
                } else {
                    $(".enStatus", this.el).addClass('btn-danger').removeClass('btn-success');
                    $(".enStatus", this.el).html("Disabled");
                }
            }
        });

    return Backbone.View.extend({

        initialize: function (options) {
            this.options = options || {};
        },

        render: function () {
            var outputs = this.model.models;
            var len = outputs.length;
            console.log("Output list: " + len + " outputs");
            
            if (len == 0) {
                $(this.el).html('<div class="col-md-12"><div class="row thumbnails"><div class="col-md-3 col-sm-2"><div class="thumbnail glowthumbnail select" style="text-align:center;"><a href="#" class="plain"><h5>No output defined</h5><p>There are no outputs defined for this instrument. Click on "Add Output" in the menu above to add one.</p></a></div></div></div></div>');
                return this;
            }
            
            var items = parseInt(settings.get('itemsperpage'));
            var startPos = (this.options.page - 1) * items;
            var endPos = Math.min(startPos + items, len);

            $(this.el).html('<div class="col-md-12"><div class="row thumbnails"></div></div>');

            for (var i = startPos; i < endPos; i++) {
                $('.thumbnails', this.el).append(new OutputListItemView({model: outputs[i]}).render().el);
            }

            $(this.el).append(new Paginator({model: this.model, page: this.options.page, viewname: 'outputs', items: items}).render().el);

            return this;
        }
    });

});