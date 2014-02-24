/**
 *  Elecraft Live Display view
 */

window.ElecraftLiveView = Backbone.View.extend({

    initialize:function () {
        this.deviceinitdone = false;

        //this.render();
        //_.bindAll(this,"handleKX3Button");
        
        linkManager.on('status', this.updateStatus, this);
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
            // Initialize icon display:
            f.select(".icon").attr({ visibility: 'hidden' });
                s.add(f);
                // Set display constraints for the radio face:
                s.attr({
                    width: "100%",
                    height: 350
                });
        });
        
        $("#rf-control", this.el).slider();
        $("#af-control", this.el).slider();
        $("#bpf-control", this.el).slider();
        $("#ct-control", this.el).slider();
        return this;
    },
    
    onClose: function() {
        linkManager.on('status', this.updatestatus, this);
        linkManager.off('input', this.showInput, this);
        console.log("Elecraft live view closing...");        
    },
    
    events: {
        "click #power-direct-btn": "setpower",
        "click input#power-direct": "setpower",
        "keypress input#power-direct": "setpower",
        "keypress input#vfoa-direct": "setvfoa",
        "keypress input#vfob-direct": "setvfob",
        "click #vfoa-direct-btn": "setvfoa",
        "click #vfob-direct-btn": "setvfob",
    },
    
    setpower: function(e) {
        if ((event.target.id == "power-direct" && event.keyCode==13) || (event.target.id != "power-direct") || 
             (event.type == "click")) {
            linkManager.driver.setPower($("#power-direct").val());
        }
    },
    
    setvfoa: function() {
        if ((event.target.id == "vfoa-direct" && event.keyCode==13) || (event.target.id != "vfoa-direct")) {
            linkManager.driver.setVFO($("#vfoa-direct",this.el).val(),"a");
        }
    },

    setvfob: function() {
        if ((event.target.id == "vfob-direct" && event.keyCode==13) || (event.target.id != "vfob-direct")) {
            linkManager.driver.setVFO($("#vfob-direct",this.el).val(),"b");
        }
    },
    
    buttonCodes: {
        "B_BAND_PLUS": "T08",
        "B_RCL": "H08",
        "B_BAND_MINUS": "T41",
        "B_STORE": "H41",
        "B_DISP": "T09",
        "B_PRE": "T19",
        "B_ATTN": "T27",
        "B_MODE": "T14",
    },

    handleKX3Button: function(e) {
        console.log(e.target.id);
        $("#kx3 #filter-II").css("visibility", "visible");
        var code = this.buttonCodes[e.target.id];
        if (code != null) {
            linkManager.manualCommand('SW' + code + ';');
        }        
    },
    
    updateStatus: function(data) {
        if (linkManager.connected && !this.deviceinitdone) {
            linkManager.startLiveStream();
            
            // Ask the radio for a few additional things:
            // Requested power:
            linkManager.driver.getRequestedPower();
        } else {
            this.deviceinitdone = false;
        }        
    },
    
    setIcon: function(name, visible) {
        $("#kx3 #" + name).css("visibility", (visible) ? "visible" : "hidden");
    },


    showInput: function(data) {
        // Now update our display depending on the data we received:
        var cmd = data.substr(0,2);
        var val = data.substr(2);
        if (cmd == "DB") {
            // VFO B Text
            $("#kx3 #VFOB").html(val + "&nbsp;&nbsp;");
        } else if (cmd == "DS") {
            // VFO A Text, a bit more tricky:
            if (val.length < 8) {
                console.log("Error: VFO A buffer too short!");
                return;
            }
            var txt = "";
            for (var i=0; i < 8; i++) {
                if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                    txt += ".";
                var val2 = val.charCodeAt(i) & 0x7F;
                // Do replacements:
                if (val2 == 0x40)
                        val2 = 0x20;
                txt += String.fromCharCode(val2);
            }
            $("#kx3 #VFOA").html(txt);
            // Now, decode icon data:
            var a = val.charCodeAt(8);
            var f = val.charCodeAt(9);
            
            
        } else if (cmd == "PC") {
            $("#power-direct").val(parseInt(val));
        } else if (cmd == "FA") {
            $("#vfoa-direct").val(parseInt(val)/1e6);
        } else if (cmd == "FB") {
            $("#vfob-direct").val(parseInt(val)/1e6);
        }    

    },

});
