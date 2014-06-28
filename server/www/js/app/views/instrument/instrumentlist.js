/**
 * Defines a list of instruments, arranged as a series of 'cards'
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
        tpl     = require('text!tpl/InstrumentListItemView.html'),
        template = null;
        
        try {
            template = _.template(tpl);
        } catch (e) {
            // Will happen if we are packaged in a Chrome app
            template = require('js/tpl/InstrumentListItemView.js');
        }
    
        var InstrumentListItemView = Backbone.View.extend({

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
                "click .select" : "selectInstrument",
                "click .edit": "editInstrument"
            },

            editInstrument: function(event) {
                var url = event.target.href.substr(event.target.baseURI.length);
                router.navigate(url, {trigger: true});
                event.stopPropagation();
            },

            selectInstrument: function(event) {
                console.log('Instrument selected: ' + this.model.id);
                var theID = this.model.id;
                // Detect if we clicked on a new instrument or not:
                if (this.model.id == instrumentManager.getInstrument().id) {
                    // If so, just return to main screen
                    router.navigate('/', true);
                }
                // Now store the instrument ID in our settings:
                settings.set({currentInstrument:theID});
                // Update our settings to use the correct port: 
                settings.set({ serialPort: this.model.get('port')});
                // If the settings changed, the router will pick this up since
                // it listens to change events in settings, and react accordingly.
                settings.save(null, {success: function() {
                }});
                return false;
            },
        });

    return Backbone.View.extend({

        initialize: function (options) {
            this.options = options || {};
        },

        render: function () {
            var instruments = this.model.models;
            var len = instruments.length;
            console.log("Instrument list: " + len + " instruments");
            var items = parseInt(settings.get('itemsperpage'));
            var startPos = (this.options.page - 1) * items;
            var endPos = Math.min(startPos + items, len);

            $(this.el).html('<div class="col-md-12"><div class="row thumbnails"></div></div>');

            for (var i = startPos; i < endPos; i++) {
                $('.thumbnails', this.el).append(new InstrumentListItemView({model: instruments[i]}).render().el);
            }

            $(this.el).append(new Paginator({model: this.model, page: this.options.page, items: items}).render().el);

            return this;
        }
    });

});