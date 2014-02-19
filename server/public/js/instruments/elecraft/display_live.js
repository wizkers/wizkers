/**
 *  
 */

window.ElecraftLiveView = Backbone.View.extend({

    initialize:function () {
        //this.render();
        //_.bindAll(this,"handleKX3Button");
        
        linkManager.on('input', this.showInput, this);

    },

    render:function () {
        var self = this;
        $(this.el).html(this.template());
        var s = Snap("#kx3");
        Snap.load("img/KX3.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleKX3Button(e);
                });
                s.add(f);
            s.attr({
                width: 1000,
                height: 400
            });
        });
        return this;
    },
    
    onClose: function() {
        linkManager.off('input', this.showInput, this);
        console.log("Elecraft live view closing...");        
    },
    
    events: {
       "click #cmdsend": "sendcmd",
        "keypress input#manualcmd": "sendcmd",
    },

    handleKX3Button: function(e) {
        console.log(e.target.id);
        linkManager.manualCommand("IF;");
    },
    
    sendcmd: function(event) {
        // We react both to button press & Enter key press
        if ((event.target.id == "manualcmd" && event.keyCode==13) || (event.target.id != "manualcmd"))
            linkManager.manualCommand($('#manualcmd',this.el).val());
    },


    showInput: function(data) {
        // Update our raw data monitor
        var i = $('#input',this.el);
        var scroll = (i.val() + JSON.stringify(data) + '\n').split('\n');
        // Keep max 50 lines:
        if (scroll.length > 50) {
            scroll = scroll.slice(scroll.length-50);
        }
        i.val(scroll.join('\n'));
        // Autoscroll:
        i.scrollTop(i[0].scrollHeight - i.height());

    },

});
