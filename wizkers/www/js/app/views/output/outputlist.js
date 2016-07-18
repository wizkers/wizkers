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
        utils = require('app/utils'),
        template = require('js/tpl/OutputListItemView.js');

    var OutputListItemView = Backbone.View.extend({

        tagName: "div",
        className: "col-md-3 col-xs-6",

        initialize: function () {},

        render: function () {
            this.$el.html(template(this.model.toJSON()));
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
                    linkManager.setOutputs(instrumentManager.getInstrument().id);
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

            this.$el.html('<div class="col-md-12 thumbnails"></div></div>');
            var editok = true;
            // Ask to hide the instrument setting in case we are a viewer or operator in server mode, because
            // the server won't let us retrieve the instrument parmeters anyway
            if (vizapp.type == 'server') {
                if (settings.get('currentUserRole') == 'viewer')
                    editok = false;
            }

	        var rowName = 'row0';
            if (!utils.checkBreakpoint('xs')) {
                this.$('.thumbnails').append('<div class="row row0"></div>');
            }
            for (var i = startPos; i < endPos; i++) {
                // If we are on a XS screen, make sure we have a nice row break
                // and no funky layout
                if (utils.checkBreakpoint('xs') && !((i-startPos) % 2)) {
                    rowName = 'row' + Math.floor((i-startPos)/2);
                    this.$('.thumbnails').append('<div class="row ' + rowName  + '"></div>');
                }
                if (i < len) {
                    $('.' + rowName, this.el).append(new OutputListItemView({
                        model: outputs[i]
                    }).render().el);
                } else {
                    // Add a "Add Output" card at the end:
                    $('.' + rowName, this.el).append('<div class="col-md-3 col-xs-6"><div class="panel panel-default"><div class="panel-heading"><h6>Add output</h6></div><div class="panel-body" style="text-align:center;"><a href="#outputs/add" class="plain"><p style="font-size:6em; margin-bottom:0px;"><span class="glyphicon glyphicon-plus-sign"></span></p><p>New output</p></a></div></div>');

                }
            }

            this.$el.append(new Paginator({
                model: this.model,
                page: this.options.page,
                viewname: 'outputs',
                items: items
            }).render().el);

            return this;
        }
    });

});