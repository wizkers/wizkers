/**
 * Defines a list of outputs, arranged as a series of 'cards'
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
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
                this.model.bind("change", this.render, this);
                this.model.bind("destroy", this.close, this);
            },

            render: function () {
                $(this.el).html(template(this.model.toJSON()));
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
                        console.log('Output status: ' + en);
                        if (en) {
                            $(".enStatus", self.el).addClass('btn-success').removeClass('btn-danger');
                            // Tell the output manager we got enabled
                            outputManager.enableOutput(self.model.get('type'));
                        } else {
                            $(".enStatus", self.el).addClass('btn-danger').removeClass('btn-success');
                            outputManager.disableOutput(self.model.get('type'));
                        }
                    }
                });
                
            },
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

            $(this.el).append(new Paginator({model: this.model, page: this.options.page, items: items}).render().el);

            return this;
        }
    });

});