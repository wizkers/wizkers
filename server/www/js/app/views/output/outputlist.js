/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Defines a list of outputs, arranged as a series of 'cards'
 *
 * @author Edouard Lafargue, ed@lafargue.name
 */

define(function (require) {

    "use strict";

    var $ = require('jquery'),
        _ = require('underscore'),
        Backbone = require('backbone'),
        Paginator = require('app/views/paginator'),
        template = require('js/tpl/OutputListItemView.js');

    var OutputListItemView = Backbone.View.extend({

        tagName: "div",
        className: "col-md-3 col-sm-2",

        initialize: function () {},

        render: function () {
            $(this.el).html(template(this.model.toJSON()));
            this.updateButtonStatus(this.model.get('enabled'));
            return this;
        },

        events: {
            "click .select": "toggleOutput",
            "click .edit": "editOutput",
        },

        editOutput: function (event) {
            var url = event.target.href.substr(event.target.baseURI.length);
            router.navigate(url, {
                trigger: true
            });
            event.stopPropagation();
        },

        toggleOutput: function (event) {
            var self = this;
            var en = this.model.get('enabled');
            en = !en;
            this.model.save({
                enabled: en
            }, {
                success: function () {
                    self.updateButtonStatus(en);
                    outputManager.reconnectOutputs();
                }
            });

        },

        updateButtonStatus: function (en) {
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
            this.options = options ||  {};
        },

        render: function () {
            var outputs = this.model.models;
            var len = outputs.length;

            var items = 4;
            var startPos = (this.options.page - 1) * items;
            var endPos = Math.min(startPos + items, len + 1);

            $(this.el).html('<div class="col-md-12"><div class="row thumbnails"></div></div>');
            var editok = true;
            // Ask to hide the instrument setting in case we are a viewer or operator in server mode, because
            // the server won't let us retrieve the instrument parmeters anyway
            if (vizapp.type == 'server') {
                if (settings.get('currentUserRole') == 'viewer')
                    editok = false;
            }

            for (var i = startPos; i < endPos; i++) {
                if (i < len) {
                    $('.thumbnails', this.el).append(new OutputListItemView({
                        model: outputs[i]
                    }).render().el);
                } else {
                    // Add a "Add Output" card at the end:
                    $('.thumbnails', this.el).append('<div class="col-md-3 col-sm-2"><div class="thumbnail glowthumbnail select" style="text-align:center;"><a href="#outputs/add" class="plain"><h5>Add output</h5><p style="font-size:6em;"><span class="glyphicon glyphicon-plus-sign"></span></p><p>Create a new output</p></a></div></div>');

                }
            }

            $(this.el).append(new Paginator({
                model: this.model,
                page: this.options.page,
                viewname: 'outputs',
                items: items
            }).render().el);

            return this;
        }
    });

});