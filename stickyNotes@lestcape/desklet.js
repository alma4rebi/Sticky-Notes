// Desklet : Sticky Notes           Version      : v0.9.1-Beta
// O.S.    : Cinnamon               Release Date : 08 February 2014.
// Author  : Lester Carballo Pérez  Email        : lestcape@gmail.com
//
// Website : https://github.com/lestcape/Sticky-Notes
//
// Based on: https://github.com/linuxmint/Cinnamon/pull/2119
//
// This is a simple desklet to add sticky notes in the desktop.
// The notes will be saved when a focus of the text editor was lost.
//
//    This program is free software:
//
//    You can redistribute it and/or modify it under the terms of the
//    GNU General Public License as published by the Free Software
//    Foundation, either version 3 of the License, or (at your option)
//    any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.
//

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Desklet = imports.ui.desklet;
const DeskletManager = imports.ui.deskletManager;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const Mainloop = imports.mainloop;
const Gtk = imports.gi.Gtk;
const Util = imports.misc.util;
const Tweener = imports.ui.tweener;
const Keymap = imports.gi.Gdk.Keymap.get_default();
const MIN_WIDTH = 170;


function _(str) {
   return Gettext.dgettext("stickyNotes@lestcape", str);
}

function MyDesklet(metadata, desklet_id){
   this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
   __proto__: Desklet.Desklet.prototype,

   _init: function(metadata, desklet_id) {
      Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
      this.metadata = metadata;
      this.uuid = this.metadata["uuid"];
      this.instance_id = desklet_id;
     // this.renderFontFamily();
      this.execInstallLanguage();
      _ = imports.gettext.domain(this.uuid).gettext;
      imports.gettext.bindtextdomain(this.uuid, GLib.get_home_dir() + "/.local/share/locale");
      this.setHeader(_("Sticky Notes"));

      this._clipboard = St.Clipboard.get_default();

      this.helpFile = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/"+this.uuid+"/locale/" + _("README");
		
      this._menu.addAction(_("Help"), Lang.bind(this, function() {
         Util.spawnCommandLine("xdg-open " + this.helpFile);
      }));
      this._menu.addAction(_("Website"), Lang.bind(this, function() {
         Util.spawnCommandLine("xdg-open http://github.com/lestcape/Sticky-Notes");
      }));

      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this.copyMenuItem = new PopupMenu.PopupMenuItem(_("Copy"));
      this.copyMenuItem.connect('activate', Lang.bind(this, this._onCopyActivated));
      this._menu.addMenuItem(this.copyMenuItem);

      this.pasteMenuItem = new PopupMenu.PopupMenuItem(_("Paste"));
      this.pasteMenuItem.connect('activate', Lang.bind(this, this._onPasteActivated));
      this._menu.addMenuItem(this.pasteMenuItem);

      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this.deleteMenuItem = new PopupMenu.PopupMenuItem(_("Delete"));
      this.deleteMenuItem.connect('activate', Lang.bind(this, this._onDeleteActivated));
      this._menu.addMenuItem(this.deleteMenuItem);

      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this.multInstanceMenuItem = new PopupMenu.PopupSwitchMenuItem(_("Multiple Instances"), false);
      this.multInstanceMenuItem.connect('activate', Lang.bind(this, this._onMultInstanceActivated));
      this._menu.addMenuItem(this.multInstanceMenuItem);

      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._entryActiveMenu = false;
      this._menu.connect('open-state-changed', Lang.bind(this, this._updateMenu));

      this.keyPress = 0;
      this._themeStaples = "none";
      this._themeStripe = "none";
      this._themePencil = "bluepencil";
      this._text = "";
      this.noteCurrent = 0;
      this._boxColor = "#000000";
      this._opacityBoxes = 0.5;
      this._borderBoxWidth = 1;
      this._borderBoxColor = "#ffffff";
      this._textSize = 12;
      this._fontFamily = ""; //Default Font family
      this._fontColor= "#ffffff";
      this._fWidth = true;
      this._width = 200;
      this._fHeight = true;
      this._height = 50;
      this._scrollVisible = true;
      this.focusIDSignal = 0;
      this.keyPressIDSignal = 0;
      this.textInsertIDSignal = 0;
      this.autoHideButtonsIDSignal = 0;
      this.scrollIDSignal = 0;
      this._multInstance = false;
      this._timeOutSettings = 0;
      try {
         Main.themeManager.connect('theme-set', Lang.bind(this, this._onThemeChange));
         this._updateComplete();
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      this._trackMouse();
   },

   _onThemeChange: function() {
     this._timeOutSettings = Mainloop.timeout_add(2000, Lang.bind(this, function() {
         this.on_desklet_removed();
         this._updateComplete();
      }));
      //this.multInstanceUpdate();
   },

   _updateComplete: function() {
      if(this._timeOutSettings > 0) {
         Mainloop.source_remove(this._timeOutSettings);
         this._timeOutSettings = 0;
      }

      this.settingsExt = Gio.Settings.new("org.cinnamon");
      this._initSettings();
      this._initDeskletContruction();
      this.setContent(this.mainBox);

      if(this.initDeskletType()) {
         this.rootBox.connect('style-changed', Lang.bind(this, this._onOpacityRootChange));
         this.textBox.connect('style-changed', Lang.bind(this, this._onOpacityTextChange));
         this._keyFocusNotifyIDSignal = global.stage.connect('notify::key-focus', Lang.bind(this, this._onKeyFocusChanged));
         this.clutterText.connect('button-press-event', Lang.bind(this, this._onButtonPress));
         this.clutterText.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
         this.textBox.connect('button-press-event', Lang.bind(this, this._onButtonPress));
         this.textBox.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
         this.entry.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));
         //this.scrollBox.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));


         this._onFixWidth();
         this._onFixHeight();
         this._onScrollVisibleChange();
         this._onScrollAutoChange();
         this._onAutoHideButtons();
         this._onHideTextBox();
         this.multInstanceMenuItem._switch.setToggleState(this._multInstance);
         Mainloop.idle_add(Lang.bind(this, this._onStyleChange));
      }
   },

   showErrorMessage: function(menssage) {
      Main.notifyError(_("Error"), menssage);
   },

   initDeskletType: function() {
      this.notesList = this.findNotesFromFile();
      this._readListPosition();
      if(this._multInstance) {
         let numberInstance = this.getInstanceNumber();
         if((numberInstance == 0)&&(this.notesList.length > 1)&&(this.getCountInstance() == 1)) {
            this.openAllMulInstance();
         }
         if(numberInstance < this.notesList.length) {
            this.readNoteFromFile(numberInstance);
            this.loadNote(numberInstance);
         } else {
            this.notesList.push([this.maxValueNote() + 1, ""]);
            this.noteCurrent = numberInstance + 1;
            this.reset();
         }
         return true;
      }
      else if(this.getCountInstance() == 1){
         this.readNotesFromFile();
         this.loadNote(0);
         return true;
      }
      DeskletManager.removeDesklet(this.uuid, this.instance_id);
      this.destroyDesklet();
      return false;
   },

   multInstanceUpdate: function() {
      try {
         this.removeAllInstances();
         this.createNewInstance();
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   createNewInstance: function() {
      try {
         let newDeskletID = this.settingsExt.get_int("next-desklet-id");
         this.settingsExt.set_int("next-desklet-id", newDeskletID + 1);
         let deskletDef;
         if(this._multInstance) {
            let monitor = Main.layoutManager.focusMonitor;
            let countMaxDesklet = monitor.width/this.mainBox.get_width();
            let numberInstance = this.getCountInstance();
            let posY = 100*Math.floor(numberInstance/countMaxDesklet);
            if(posY > monitor.height)
               posY = 100;
            let posX = Math.floor(numberInstance % countMaxDesklet)*this.mainBox.get_width();
            
            let storePos = this.positions["" + this.notesList[this.getCountInstance()][0]];
            if(storePos)
               deskletDef = (this.uuid + ':%s:%s:%s').format(newDeskletID, storePos[0], storePos[1]);
            else
               deskletDef = (this.uuid + ':%s:%s:%s').format(newDeskletID, posX, posY);
         }
         else {
            deskletDef = (this.uuid + ':%s:%s:%s').format(newDeskletID, this._xPosition, this._yPosition);
         }
         let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
         enabledDesklets.push(deskletDef);
         this.settingsExt.set_strv("enabled-desklets", enabledDesklets);
         
      } catch (e) {
         this.showErrorMessage(e.message);
      }
   },

   removeAllInstances: function() {
      let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
      let def, id;
      for(idPos in enabledDesklets) {
         def = this._getDeskletDefinition(enabledDesklets[idPos]);
         if((def)&&(def.uuid == this.uuid)) {
            let id = parseInt(def.desklet_id);
            if(id != parseInt(this.instance_id))
               DeskletManager.removeDesklet(this.uuid, id);
         }
      }
      DeskletManager.removeDesklet(this.uuid, this.instance_id);
   },

   destroyDesklet: function(){
        this.on_desklet_removed();
        this.actor.destroy();
        this._menu.destroy();
        this._menu = null;
        this._menuManager = null;
        this.emit('destroy');
    },

   openAllMulInstance: function() {
      try {
         if(this._multInstance) {
            let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
            let listDesklet = this.findNotesFromFile();
            let initNumber = this.getCountInstance();
            if(listDesklet.length == 0)
               this.createNewInstance();
            else {
               for(let index = initNumber; index < listDesklet.length; index++)
                  this.createNewInstance();
            }
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   getInstanceNumber: function() {
      let currentInstance = parseInt(this.instance_id);
      let resultNumber = 0;
      try {
         let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
         let def, id;
         for(idPos in enabledDesklets) {
            def = this._getDeskletDefinition(enabledDesklets[idPos]);
            if((def)&&(def.uuid == this.uuid)) {
               let id = parseInt(def.desklet_id);
               if(id < currentInstance)
                  resultNumber++;
            }
         }
      } catch (e) {
         this.showErrorMessage(e.message);
         resultNumber = -1;
      }
      return resultNumber;
   },

   getCountInstance: function() {
      let resultNumber = 0;
      try {
         let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
         let def, id;
         for(idPos in enabledDesklets) {
            def = this._getDeskletDefinition(enabledDesklets[idPos]);
            if((def)&&(def.uuid == this.uuid)) {
               resultNumber++;
            }
         }
      } catch (e) {
         this.showErrorMessage(e.message);
         resultNumber = -1;
      }
      return resultNumber;
   },

   getMasterInstance: function() {
      let currentInstance = parseInt(this.instance_id);
      try {
         let enabledDesklets = this.settingsExt.get_strv("enabled-desklets");
         let def, id;
         for(idPos in enabledDesklets) {
            def = this._getDeskletDefinition(enabledDesklets[idPos]);
            if((def)&&(def.uuid == this.uuid)) {
               let id = parseInt(def.desklet_id);
               if(id < currentInstance)
                  currentInstance = id;
            }
         }
      } catch (e) {
         this.showErrorMessage(e.message);
      }
      return currentInstance;
   },

   _getDeskletDefinition: function(definition) {
      let elements = definition.split(":");
      if(elements.length == 4) {
         return {
            uuid: elements[0],
            desklet_id: elements[1],
            x: elements[2],
            y: elements[3]
         };
      } else {
         global.logError("Bad desklet definition: " + definition);
         return null;
      }
   },

   newNote: function(noteMessage) {
      if((noteMessage)&&(noteMessage != "")&&(noteMessage != _("Type to your note..."))) {
         if((this.notesList.length == 0)||(this.noteCurrent > this.notesList.length)) {
            try {
               let maxValue = this.maxValueNote();
               this.noteCurrent = this.notesList.length;
               let strinName = (maxValue + 1).toString();
               this.notesList.push([strinName, noteMessage]);
               this.writeNoteToFile(this.noteCurrent);
               this.numberNote.set_text(this.notesList.length.toString());
               this.noteCurrent = this.notesList.length;
               this.currentNote.set_text(this.noteCurrent.toString());
            } catch(e) {
               this.showErrorMessage(e.message);
            }
         } else {
            if(this.noteCurrent == 0)
               this.noteCurrent++;
            if(this.notesList[this.noteCurrent - 1][1] != noteMessage) {
               this.notesList[this.noteCurrent - 1][1] = noteMessage;
               this.writeNoteToFile(this.noteCurrent - 1);
            }
         }
      }
   },

   maxValueNote: function(noteMessage) {
      let maxValue = 0;
      let currValue;
      for(let pos in this.notesList) {
         currValue = parseInt(this.notesList[pos][0]);
         if(currValue > maxValue)
            maxValue = currValue;
      }
      return maxValue;
   },

   loadNote: function(pos) {
      if((this.notesList.length == 0)||(pos < 0)||(pos > this.notesList.length)) {
         this.noteCurrent = 1;
         this.reset();
      } else {
         this.noteCurrent = pos + 1;
         this.entry.text = this.notesList[pos][1];
      }
      this.numberNote.set_text(this.notesList.length.toString());
      this.currentNote.set_text(this.noteCurrent.toString());
      this._text = this.entry.text;
      this.titleNote.set_text(this.entry.text);
   },

   writeNoteToFile: function(pos) {
      if((pos > -1)&&(pos < this.notesList.length)) {
         try {
            let output_file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + this.notesList[pos][0] + ".note");
            this._makeDirectoy(output_file.get_parent());
            this.deleteNote(pos);
            let fstream = output_file.replace("", false, Gio.FileCreateFlags.NONE, null);
            let dstream = new Gio.DataOutputStream.new(fstream);   

            dstream.put_string(this.notesList[pos][1], null);
            fstream.close(null);
            return true;
         } catch(e) {
            this.showErrorMessage(e.message);
         }
      }
   },

   deleteNote: function(pos) {
      if((pos > -1)&&(pos < this.notesList.length)) {
         let file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + this.notesList[pos][0] + ".note");
         if(file.query_exists(null))
            return file.delete(null);
      } 
      return false;
   },

   readNotesFromFile: function() {
      try {
         for(let pos in this.notesList) {
            this.readNoteFromFile(pos);
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   readNoteFromFile: function(pos) {
      if((pos > -1)&&(pos < this.notesList.length)) {
         let file = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes/" + this.notesList[pos][0] + ".note");
         if(file.query_exists(null))
         {
            try {
               let fstream = file.read(null);
               let dstream = new Gio.DataInputStream.new(fstream);
               let data = dstream.read_until("", null);
               fstream.close(null);
               if(data[0])
                  this.notesList[pos][1] = data[0];
               else
                  this.notesList[pos][1] = "";
            } catch(e) {
               this.showErrorMessage(e.message);
            }
         } else
            this.showErrorMessage(e.message);
      }
   },

   findNotesFromFile: function() {
      let notes = new Array();
      try {
         let notesFolder = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/notes");
         if(!this._isDirectory(notesFolder)) {
            return notes;
         }
         let children = notesFolder.enumerate_children('standard::name,standard::type',
                                                       Gio.FileQueryInfoFlags.NONE, null);
         let info, nameFile, lastIndex;
         while((info = children.next_file(null)) != null) {
            if(info.get_file_type() == Gio.FileType.REGULAR) {
               nameFile = info.get_name();
               lastIndex = nameFile.lastIndexOf(".");
               if(nameFile.substring(lastIndex) == ".note") {
                  notes.push([nameFile.substring(0, lastIndex), ""]);
               }
            }
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      return this._sorting(notes);
   },

   isNoteInList: function(noteName) {
      for(let i = 0; i < this.notesList.length; i++) {
         if(this.notesList[i][0] == noteName)
            return true;
      }
      return false;
   },

   _sorting: function(notes) {
      let valueL, valueF, tempSwap;
      for(let posF=0; posF < notes.length - 1; posF++) {
         valueF = parseInt(notes[posF][0]);
         for(let posL=posF + 1; posL < notes.length; posL++) {
            valueL = parseInt(notes[posL][0]);
            if(valueL < valueF) {
               tempSwap = notes[posL];
               notes[posL] = notes[posF];
               notes[posF] = tempSwap;
            }
         }
      }
      return notes;
   },

   _onAddNote: function(actor) {
      this._effectIcon(actor, 0.2);
      if(this._multInstance) {
        this.createNewInstance();
      }
      else {
         this.reset();
         this.noteCurrent = this.notesList.length + 1;
         this.currentNote.set_text(this.noteCurrent.toString());
      }
   },

   _onVisibleNoteChange: function(actor) {
      this.leftBox.remove_actor(actor);
      if(this.minimizeButton == actor) {
         this.leftBox.add(this.maximizeButton, {x_fill: true, x_align: St.Align.END});
         this._changeHideTextBox(true);
         this.scrollBox.visible = false;
         if(this._fHeight) {
            this.mainBox.set_height(-1);
         }

      }
      else {
         this.leftBox.add(this.minimizeButton, {x_fill: true, x_align: St.Align.END}); 
         this._changeHideTextBox(false);
         this.scrollBox.visible = true;
         if(this._fHeight) {
            this.fixHeight(true);
         }

      }
   },

   _onRemoveNote: function(actor) {
      try {
         this._effectIcon(actor, 0.2);
         if(this._multInstance) {
            this.deleteNote(this.noteCurrent - 1);
            DeskletManager.removeDesklet(this.uuid, this.instance_id);
         } else {
            if(this.notesList.length > 1) { 
               if((this.noteCurrent != 0)&&(this.noteCurrent <= this.notesList.length)) {
                  if(this.deleteNote(this.noteCurrent - 1)) {
                     this.notesList.splice(this.noteCurrent - 1, 1);
                     this.numberNote.set_text(this.notesList.length.toString());
                     if(this.noteCurrent > this.notesList.length) {
                        this.noteCurrent = this.notesList.length;
                        this.currentNote.set_text(this.noteCurrent.toString());
                        this.entry.text = this.notesList[this.noteCurrent - 1][1];
                     } else
                        this.entry.text = this.notesList[this.noteCurrent][1];
                  }
               } else if(this.noteCurrent == 0) {
                  if(this.deleteNote(this.noteCurrent)) {
                     this.notesList.splice(this.noteCurrent, 1);
                     this.entry.text = this.notesList[this.noteCurrent][1];
                     this.numberNote.set_text(this.notesList.length.toString());
                  }
               }
            } else if(this.notesList.length == 1) {
               if(this.deleteNote(0)) {
                  this.noteCurrent = 1;
                  this.notesList.splice(0, 1);
                  this.numberNote.set_text("0");
                  this.currentNote.set_text("1");
                  this.reset();
               }
            }
         }
        // this.showErrorMessage("noteCurrent: " + this.noteCurrent + " lengh:" + this.notesList.length);
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onBackNote: function(actor) {
      if(this.notesList.length != 0) {
         this._effectIcon(actor, 0.2);
         if((this.noteCurrent == 0)||(this.noteCurrent == 1)) {
            this.noteCurrent = this.notesList.length;
            this.entry.text = this.notesList[this.noteCurrent - 1][1];
            this.currentNote.set_text(this.noteCurrent.toString());
         }
         else if(this.noteCurrent > 0) {
            this.noteCurrent--;
            this.entry.text = this.notesList[(this.noteCurrent - 1)][1];
            this.currentNote.set_text(this.noteCurrent.toString());
         }
      }
   },

   _onNextNote: function(actor) {
      if(this.notesList.length != 0) {
         this._effectIcon(actor, 0.2);
         if(this.noteCurrent == 0) {
            if(this.notesList.length != 1) {
               this.noteCurrent = 2;
               this.entry.text = this.notesList[(this.noteCurrent - 1)][1];
               this.currentNote.set_text(this.noteCurrent.toString());
            }
         }
         else {
            if(this.noteCurrent < this.notesList.length) {
               this.entry.text = this.notesList[this.noteCurrent][1];
               this.currentNote.set_text((this.noteCurrent + 1).toString());
            } else {
               this.noteCurrent = 0;
               this.entry.text = this.notesList[this.noteCurrent][1];
               this.currentNote.set_text((this.noteCurrent + 1).toString());
            }
            this.noteCurrent++;
         }
      }
   },

   _onConfigNote: function(actor) {
      this._effectIcon(actor, 0.2);
      Util.spawn(['cinnamon-settings', 'desklets', this.uuid]);
   },

   _isDirectory: function(fDir) {
      try {
         let info = fDir.query_filesystem_info("standard::type", null);
         if((info)&&(info.get_file_type() != Gio.FileType.DIRECTORY))
            return true;
      } catch(e) {
      }
      return false;
   },

   _makeDirectoy: function(fDir) {
      if(!this._isDirectory(fDir))
         this._makeDirectoy(fDir.get_parent());
      if(!this._isDirectory(fDir))
         fDir.make_directory(null);
   },

   setStyle: function() {
      this.setStaples();
      this.setStripe();

      if(this._overrideTheme) {
         let _colorBox = (this._boxColor.replace(')',',' + this._opacityBoxes + ')')).replace('rgb','rgba');
         let _colorText = (this._textBoxColor.replace(')',',' + this._opacityBoxes + ')')).replace('rgb','rgba');
         let _colorBanner = (this._boxColor.replace(')',',' + 0.1 + ')')).replace('rgb','rgba');
         if(this._themeStaples != "none") {
            this.rootBox.set_style('background-color: ' + _colorBox + '; color: ' + this._fontColor + '; border: ' +
                                   this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                                   '; border-top: none; padding: 0px 4px 0px 4px; font-weight: bold; border-radius: 12px;');
         } else {
            this.rootBox.set_style('background-color: ' + _colorBox + '; color: ' + this._fontColor + '; border: ' +
                                   this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                                   '; padding: 0px 4px 0px 4px; font-weight: bold; border-radius: 12px;');
         }
         if(this._overrideTextBox) {
            this.textBox.set_style_class_name('');
            this.textBox.set_style('background-color: ' + _colorText + ';' +
                                   'border-radius: 4px; border: 2px solid ' + _colorText + ';');
         }
         else {
            this.textBox.set_style_class_name('sticky-text-box');
            this.textBox.set_style('background-color: ' + _colorText + ';');
         }
         this.buttonBanner.set_style_class_name('');
         this.buttonBanner.set_style('background-color: ' + _colorBanner);
      } else {
         this.rootBox.set_style_class_name('desklet-with-borders');
         if(this._themeStaples != "none") {
            this.rootBox.add_style_class_name('sticky-main-box-staples');
            this.rootBox.set_style('border-top: none; padding-top: 0px;');
         }
         else 
            this.rootBox.add_style_class_name('sticky-main-box-none');

         this.textBox.set_style_class_name('sticky-text-box');
         this.buttonBanner.set_style_class_name('sticky-button-box');
         this.buttonBanner.set_style('');
         this.textBox.set_style('');
      }
   },

   setStripe: function() {
     // desc.set_family("Monospace"); 13
     // desc.set_family("UnPilgi"); 13
     // desc.set_family("Times New Roman"); 14
      let fontTag = '';
      if((this._fontFamily)&&(this._fontFamily != ""))
         fontTag = 'font-family: ' + this._fontFamily + ';';

      if(this._overrideTheme)
         this.entry.set_style('font-size: ' + this._textSize  + 'pt; color: ' + this._fontColor + '; font-weight: normal; caret-color: ' +
                              this._fontColor + '; selected-color: ' + this._textSelectedColor + ';' + fontTag);
      else
         this.entry.set_style('font-size: ' + this._textSize  + 'pt;' + fontTag);

      if(this._themeStripe != "none") {
         let image = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/stripe/" + this._themeStripe + "/";
         let textHeight = this._getTextHeight();
         let imageNumber = Math.floor(textHeight);
         let suported = true;
         if(imageNumber != textHeight) {
            let newVal = this._textSize*imageNumber/textHeight;
            if(this._overrideTheme)
               this.entry.set_style('font-size: ' + newVal + 'pt; color: ' + this._fontColor + '; font-weight: normal; caret-color: ' +
                                     this._fontColor + '; selected-color: ' + this._textSelectedColor + ';' + fontTag);
            else
               this.entry.set_style('font-size: ' + newVal + 'pt;' + fontTag);
            textHeight = this._getTextHeight();
         }
         if((imageNumber < 10)||(imageNumber > 60)||(imageNumber != textHeight)) {
            this.showErrorMessage(_("Unsupported text size '%s'  to use the font '%s' in this theme.").format(this._textSize, this._fontFamily));
            this.textAreaBox.set_style('min-width:' + MIN_WIDTH + 'px;');
         } else {
            this.textAreaBox.set_style('background-image: url(\'' + image + imageNumber + '.png\'); ' +
                                       'background-repeat: repeat; background-position: 0px 0px; ' + 'background-size: auto; ' +
                                       'min-width: ' + MIN_WIDTH + 'px;');
         }
      } else {
         this.textAreaBox.set_style('min-width: ' + MIN_WIDTH + 'px;');
      }
   },

   setStaples: function() {
      if(this._themeStaples != "none") {
         let imageG = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/staples/"+ this._themeStaples +"/";
         this.transpBox.set_style('background-image: url(\'' + imageG + '1.png\');' +
                                  'background-repeat: repeat; background-position: 0px 0px;');

         this.endBox.set_style('background-image: url(\'' + imageG + '2.png\');' +
                               'background-repeat: repeat; background-position: 0px 0px;');
         this.transpBox.set_height(10);
         this.endBox.set_height(15);
      } else {
         this.transpBox.set_height(0);
         this.endBox.set_height(0);
      }
   },

   setPencil: function(activePencil) {
      if((this._themePencil != "none")&&(activePencil)) {
         let image = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/pencil/" + this._themePencil + ".svg";
         this.pencilBox.set_style(' background-image: url(\'' + image + '\'); background-size:' + this.pencilBox.width +'px ' +
                                  this.pencilBox.height + 'px; max-width: 200px; min-width: 60px; padding: 0px 10px 0px 10px');
      } else {
         this.pencilBox.set_style('max-width: 200px; min-width: 60px; padding: 0px 10px 0px 10px');
      }
   },

   _getTextHeight: function() {
      let context = this.entry.get_pango_context();
      let themeNode = this.entry.get_theme_node();
      let font = themeNode.get_font();
      let metrics = context.get_metrics(font, context.get_language());
      return Pango.units_to_double(metrics.get_ascent() + metrics.get_descent());
   },

   reset: function () {
      this._getTextHeight();
      this.entry.text = "";
      this.setPencil(false);
      global.stage.set_key_focus(null);
   },

   _initDeskletContruction: function() {
      this.mainBox = new St.BoxLayout({vertical:true, reactive: true, track_hover: true});
      this.rootBox = new St.BoxLayout({vertical:true});
      this.bannerBox = new St.BoxLayout({vertical:true});
      this.buttonBanner = new St.BoxLayout({ vertical:false, style_class: 'sticky-button-box' });
      this.leftBox = new St.BoxLayout({vertical:false});
      this.centerBox = new St.BoxLayout({vertical:false});
      this.pencilBox = new St.BoxLayout({vertical:true});
      let rightBox = new St.BoxLayout({vertical:false}); 
      this.textBox = new St.BoxLayout({ vertical:true, reactive: true, style_class: 'sticky-text-box' });
      this.textAreaBox = new St.BoxLayout({vertical:true/*, reactive: true*/});

      this.bottomBox = new St.BoxLayout({ vertical:false, height: 6 });

      let addButton = this._buttonCreation('list-add', _("Add new Note"), true);
      addButton.connect('clicked', Lang.bind(this, this._onAddNote));
      this.leftBox.add(addButton, {x_fill: true, x_align: St.Align.END});

      this.minimizeButton = this._buttonCreation('go-up', _("Minimize Note"), true);
      this.minimizeButton.connect('clicked', Lang.bind(this, this._onVisibleNoteChange));
      this.maximizeButton = this._buttonCreation('go-down', _("Maximize Note"), true);
      this.maximizeButton.connect('clicked', Lang.bind(this, this._onVisibleNoteChange));
      this.leftBox.add(this.minimizeButton, {x_fill: true, x_align: St.Align.END});

      this.currentNote = new St.Label({ style_class: 'sticky-information-label' });
      this.currentNote.set_text("1");

      this.numberNote = new St.Label({ style_class: 'sticky-information-label' });
      this.numberNote.set_text("0");

      let separator = new St.Label({ style_class: 'sticky-information-label' });
      separator.set_text("/");

      this.titleNote = new St.Label({ style_class: 'sticky-title-label' });
      this.titleNote.set_text("");
      this.titleNote.set_height(16);

      let backButton = this._buttonCreation('edit-undo', _("Back Note"), true);
      backButton.connect('clicked', Lang.bind(this, this._onBackNote));

      let nextButton = this._buttonCreation('edit-redo', _("Next Note"), true);
      nextButton.connect('clicked', Lang.bind(this, this._onNextNote));

      if(!this._multInstance) {
         this.centerBox.add(backButton, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});
         this.centerBox.add(this.currentNote, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});
         this.centerBox.add(separator, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});
         this.centerBox.add(this.numberNote, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});
         this.centerBox.add(nextButton, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});      
      } else
         this.centerBox.add(this.titleNote, {x_fill: false, y_fill: false, expand: true, x_align: St.Align.MIDDLE});
      //this.centerBox.set_width(80);

      this.pencilBox.add(this.centerBox, {x_fill: false, y_fill: false, expand: true, y_align: St.Align.MIDDLE});
      this.setPencil(false);

      let configButton = this._buttonCreation('preferences-system', _("Configure..."), true);
      configButton.connect('clicked', Lang.bind(this, this._onConfigNote));

      let deleteButton = this._buttonCreation('window-close', _("Remove Note"), true);
      deleteButton.connect('clicked', Lang.bind(this, this._onRemoveNote));
      
      rightBox.add(configButton, {x_fill: true, x_align: St.Align.END});
      rightBox.add(deleteButton, {x_fill: true, x_align: St.Align.END});

      this.buttonBanner.add(this.leftBox, {x_fill: true, x_align: St.Align.START});
      this.buttonBanner.add(this.pencilBox, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
      this.buttonBanner.add(rightBox, {x_fill: true, x_align: St.Align.END});

      this.bannerBox.add(this.buttonBanner, { x_fill: true, y_fill: false, expand: true, x_align: St.Align.MIDDLE, y_align: St.Align.START });
      this.bannerBox.set_style('padding-top: 6px;');

      this.entry = new St.Entry({ name: 'sticky-note-entry', hint_text: _("Type to your note..."), track_hover: false, can_focus: true});
      //this.textBox.add(this.entry, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START});
      this.textBox.add(this.textAreaBox, { x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START });
      this.textAreaBox.add(this.entry, { x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START });

      this.transpBox = new St.BoxLayout({vertical:true});
      this.endBoxBackGround = new St.BoxLayout({ vertical:true/*, style_class: 'sticky-top-box'*/ });
      this.endBox = new St.BoxLayout({vertical:false});
      this.endBoxBackGround.add(this.endBox, {x_fill: false, x_align: St.Align.MIDDLE});

      this.rootBox.add(this.endBoxBackGround, {x_fill: true, y_fill: false, expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.START });
      this.rootBox.add(this.bannerBox, { x_fill: true, y_fill: false, expand: false, x_align: St.Align.MIDDLE, y_align: St.Align.START });

      this.mainBox.add(this.transpBox, {x_fill: false, x_align: St.Align.MIDDLE});
      this.mainBox.add(this.rootBox, {x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START });

      this.clutterText = this.entry.clutter_text;
      this.clutterText.set_single_line_mode(false);
      this.clutterText.set_activatable(false);
      this.clutterText.set_line_wrap(true);
      this.clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
      this.clutterText.set_selectable(true);
//scroll
      this.scrollArea = new St.ScrollView({ name: 'sticky-scrollview', x_fill: true, y_fill: true, y_align: St.Align.START, style_class: 'vfade' });
      this.scrollArea.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

      this.scrollBox = new St.BoxLayout({vertical:false});
      this.scrollBox.add(this.scrollArea, { x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START });
      this.scrollBox.set_style('padding-top: 6px;');

      this.scrollArea.add_actor(this.textBox);
//scroll
      this.rootBox.add(this.scrollBox, { x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START });
      this.rootBox.add(this.bottomBox, { x_fill: true, y_fill: false, expand: false, y_align: St.Align.END });
   },

   _scrollFilter: function(actor, event) {
      let heightNew = this.entry.get_height();
      if(!this._heightEntry)
         this._heightEntry = heightNew;
      if((heightNew != this._heightEntry)&&(this.symbol != Clutter.Delete)) {
         let newValue = this.scrollArea.vscroll.get_adjustment().value + heightNew - this._heightEntry;
         this.scrollArea.vscroll.get_adjustment().set_value(newValue);
      }
      this._heightEntry = heightNew;
   },

   enableScrolling: function(scrolling) {
      if(this.textBox.get_parent() == this.scrollBox)
         this.scrollBox.remove_actor(this.textBox);
      else {
         this.scrollArea.remove_actor(this.textBox);
         this.scrollBox.remove_actor(this.scrollArea);
      }
      if(scrolling) {
         this.scrollArea.add_actor(this.textBox);
         this.scrollBox.add(this.scrollArea, { x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START });
         if(this.scrollIDSignal == 0)
            this.scrollIDSignal = this.scrollBox.connect('event', Lang.bind(this, this._scrollFilter));
      } else {
         this.scrollBox.add(this.textBox, {x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START});
         if(this.scrollIDSignal > 0)
            this.scrollBox.disconnect(this.scrollIDSignal);
         this.scrollIDSignal = 0;
      }
   },

   fixHeight: function(fix) {
      this._fHeight = fix;
      if(fix) {
         if(this.scrollBox.visible)
            this.mainBox.set_height(this._height);
      } else {
         this.mainBox.set_height(-1);
      }
      this.enableScrolling(fix);
   },

   fixWidth: function(fix) {
      this._fWidth = fix;
      if(fix) {
         this.mainBox.set_width(this._width);
      }
      else {
         this.mainBox.set_width(-1);
      }
   },

   _onAllocationChanged: function() {
      let availWidth = this.entry.get_width();
      if(availWidth < MIN_WIDTH)
         availWidth = MIN_WIDTH;
      let diff = (availWidth % 18);
      this.transpBox.set_width(availWidth - diff);
      this.endBox.set_width(availWidth - diff);
   },

   on_desklet_removed: function() {
      this.reset();
      if(this._keyFocusNotifyIDSignal > 0)
         global.stage.disconnect(this._keyFocusNotifyIDSignal);
      this._keyFocusNotifyIDSignal = 0;
      if(this.focusIDSignal > 0)
         this.clutterText.disconnect(this.focusIDSignal);
      this.focusIDSignal = 0;
      if(this.keyPressIDSignal > 0)
         this.clutterText.disconnect(this.keyPressIDSignal);
      this.keyPressIDSignal = 0;
      if(this.textInsertIDSignal > 0)
         this.clutterText.disconnect(this.textInsertIDSignal);
      this.textInsertIDSignal = 0;
      if(this.autoHideButtonsIDSignal > 0)
         this.mainBox.disconnect(this.autoHideButtonsIDSignal);
      this.autoHideButtonsIDSignal = 0;
      if(this.scrollIDSignal > 0)
         this.scrollBox.disconnect(this.scrollIDSignal);
      this.scrollIDSignal = 0;
      this.settings.finalize();
   },

   _buttonCreation: function(icon, toolTip, iconSymbolic) {
      let iconType;
      if(iconSymbolic) iconType = St.IconType.SYMBOLIC;
      else iconType = St.IconType.FULLCOLOR;
      let bttIcon = new St.Icon({icon_name: icon, icon_type: iconType,
				 style_class: 'popup-menu-icon' });
      let btt = new St.Button({ child: bttIcon });
      btt.connect('notify::hover', Lang.bind(this, function(actor) {
         if(actor.get_hover()) {
            global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
            actor.set_style_class_name('menu-category-button-selected');
            actor.add_style_class_name('sticky-button-selected');
         }
         else {
            global.unset_cursor();
            actor.set_style_class_name('menu-category-button');
            actor.add_style_class_name('sticky-button');
         }
      }));
      btt.set_style_class_name('menu-category-button');
      btt.add_style_class_name('sticky-button')
      btt.set_style('padding: 2px;');
      let bttTooltip = new Tooltips.Tooltip(btt, toolTip);
      return btt;
   },

   _effectIcon: function(effectIcon, time) {
      Tweener.addTween(effectIcon,
      {  opacity: 0,
         time: time,
         transition: 'easeInSine',
         onComplete: Lang.bind(this, function() {
            Tweener.addTween(effectIcon,
            {  opacity: 255,
               time: time,
               transition: 'easeInSine'
            });
         })
      });
   },

   _onKeyFocusChanged: function() {
      let focusedActor = global.stage.get_key_focus();
      if((focusedActor)&&(this.entry.contains(focusedActor))&&(this.focusIDSignal == 0)&&(!this._entryActiveMenu)) {
         this.setPencil(false);
         global.stage.set_key_focus(null);
      }
   },

   _onFocusOut: function(actor, event) {
      try {
         if(this.focusIDSignal > 0)
            this.clutterText.disconnect(this.focusIDSignal);
         this.focusIDSignal = 0;
         if(this.keyPressIDSignal == 0)
            this.clutterText.disconnect(this.keyPressIDSignal);
         this.keyPressIDSignal = 0;
         if(this.textInsertIDSignal == 0)
            this.clutterText.disconnect(this.textInsertIDSignal);
         this.textInsertIDSignal = 0;
         this.newNote(this.entry.text);
         this._text = this.entry.text;
         this.titleNote.set_text(this.entry.text);
         this.setPencil(false);
         global.stage.set_key_focus(null);
         this._onAutoHideButtons();
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   _onButtonPress: function(actor, event) {
      try {
         if(this.focusIDSignal == 0)
            this.focusIDSignal = this.clutterText.connect('key-focus-out', Lang.bind(this, this._onFocusOut));
         if(this.keyPressIDSignal == 0)
            this.keyPressIDSignal = this.clutterText.connect('key-press-event', Lang.bind(this, this._onKeyPress));
         if(this.textInsertIDSignal == 0)
            this.textInsertIDSignal = this.clutterText.connect('insert-text', Lang.bind(this, this._onInsertText));
         this.setPencil(true);
         global.stage.set_key_focus(this.clutterText);
         if (event.get_button() == 1) {
            global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
            global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
            this.fixWidth(this._fWidth);
         }
         else if (event.get_button() == 3) {
            this._entryActiveMenu = true;
            this._updateCopyItem();
            this._updatePasteItem();
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   

   _onButtonRelease: function(actor, event) {
      if(this._entryActiveMenu) {
          this._onButtonReleaseEvent(this.actor, event);
          if(this.selection) {
            let len = this.selection.length;
            let lenClutter = this.clutterText.text.length;
            if((len > 0)&&(this.selectBounds >= 0)&&(this.selectBounds <= lenClutter))
               this.clutterText.set_selection(this.selectBounds - this.selection.length, this.selectBounds);
         }
      } 
      else if(this._menu.isOpen)
         this._onButtonReleaseEvent(this.actor, event);
      this._entryActiveMenu = false;
   },
/*
   _deleteSelection: function(actor, event) {
      this.selection = "";
      this.selectBounds = 0;
      this.clutterText.set_selection(0,0);
   },
*/
   _updateMenu: function(menu, open) {
      if(open) {
         if(!this._entryActiveMenu) {
            this._updateCopyItem();
            this._updatePasteItem();
         }
      }
   },

   _updateCopyItem: function() {
      this.selectBounds = this.clutterText.get_selection_bound();
      this.cursorPosition = this.clutterText.get_cursor_position();
      this.selection = this.clutterText.get_selection();
      this.copyMenuItem.setSensitive(this.selection && this.selection != '');

      let len = this.clutterText.text.length;
      if(this.selectBounds == -1)
        this.selectBounds = len;
      if(this.cursorPosition == -1)
         this.selectBounds = this.selectBounds + this.selection.length;
      else if(this.selectBounds < this.cursorPosition)
         this.selectBounds = this.selectBounds + this.selection.length;
      this.deleteMenuItem.setSensitive(this.selection && this.selection != '' && this.selectBounds);
   },

   _updatePasteItem: function() {
      this._clipboard.get_text(Lang.bind(this,
         function(clipboard, text) {
            this.pasteMenuItem.setSensitive(text && text != '' && this.clutterText.text != '' && this._isActivated());
         }));
    },

   _onCopyActivated: function() {
       this._clipboard.set_text(this.selection);
    },

   _onPasteActivated: function() {
      this._clipboard.get_text(Lang.bind(this,
         function(clipboard, text) {
            if (!text)
               return;
            this.clutterText.delete_selection();
            let pos = this.clutterText.get_cursor_position();
            this.clutterText.insert_text(text, pos);
         }));
   },

   _onDeleteActivated: function() {
      this.clutterText.delete_text(this.selectBounds - this.selection.length, this.selectBounds);
   },

   _onMultInstanceActivated: function() {
      this._multInstance = this.multInstanceMenuItem._switch.state;
      this.multInstanceUpdate();
   },

   // the entry does not show the hint
   _isActivated: function() {
      return this.clutterText.text == this.entry.get_text();
   },

   _onKeyPress: function(actor, event) {
      this.keyPress = new Date().getTime();
      this.oldEntryText = actor.get_text();
      this.symbol = event.get_key_symbol();
      if((Keymap.get_caps_lock_state())&&((event.get_state()) & (Clutter.ModifierType.CONTROL_MASK))) {
         if((this.symbol == Clutter.KEY_c) || (this.symbol == Clutter.KEY_C)) {
            // allow ctrl+c event to be handled by the clutter text.
            this._clipboard.set_text(actor.get_selection());
            return true;
         }
         if((this.symbol == Clutter.KEY_v) || (this.symbol == Clutter.KEY_V)) {
            // allow ctrl+v event to be handled by the clutter text.
            this._clipboard.get_text(Lang.bind(this,
               function(clipboard, text) {
                  if(!text)
                     return;
                  this.clutterText.delete_selection();
                  let pos = this.clutterText.get_cursor_position();
                  this.keyPress = 0;
                  this.clutterText.insert_text(text, pos);
            }));
            return true;
         }
      }


      if(this.symbol == Clutter.Escape) {
         if(this._isActivated()) {
            this.reset();
            return true;
         }
      }
      if(this.symbol == Clutter.Down) {
         let newValue = this.scrollArea.vscroll.get_adjustment().value + this._getTextHeight();
         if(newValue < this.scrollArea.vscroll.get_adjustment().upper)
            this.scrollArea.vscroll.get_adjustment().set_value(newValue);
         else
            this.scrollArea.vscroll.get_adjustment().set_value(this.scrollArea.vscroll.get_adjustment().upper);
         return false;
      }
      if(this.symbol == Clutter.Up) {
         let newValue = this.scrollArea.vscroll.get_adjustment().value - this._getTextHeight();
         if(newValue >= 0)
            this.scrollArea.vscroll.get_adjustment().set_value(newValue);
         else
            this.scrollArea.vscroll.get_adjustment().set_value(0);
         return false;
      }
      return false;
   },

   _onInsertText: function(actor, newText, length) {
      if((new Date().getTime() - this.keyPress < 50)&&(Keymap.get_caps_lock_state())) {
         let position = -1;
         let newEntryText = actor.get_text();
         for(let i = 0; i < newEntryText.length; i++) {
            if(this.oldEntryText.charAt(i) != newEntryText.charAt(i)) {
               position = i;
               break;
            }
         }
         if(position != -1) {
            //this.keyPress = false;
            actor.delete_text(position, position + 1);
            actor.insert_text(newText.toUpperCase(), position);
         }
      }
      //this.keyPress = false;
      return false;
   },

   _onMultInstanceChange: function() {
      if(this.instance_id ==  this.getMasterInstance()) {
         this.multInstanceUpdate();
         this.multInstanceMenuItem._switch.setToggleState(this._multInstance);
      }
   },

   _onStyleChange: function() {
      this.setStyle();
   },

   _onOpacityDeskletChange: function() {
      this.mainBox.opacity = 255*this._opacityDesklet;
   },

   _onOpacityBoxesChange: function() {
      this._onOpacityRootChange();
      this._onOpacityTextChange();
      return true;
   },

   _onOpacityRootChange: function() {
      let themeNode = this.rootBox.get_theme_node();
      let boxColor, remplaceColor;
      let newStyle;
      if(this._overrideTheme) {
         let _colorBox = (this._boxColor.replace(')',',' + this._opacityBoxes + ')')).replace('rgb','rgba');
         if(this._themeStaples != "none")
            newStyle = 'background-color: ' + _colorBox + '; color: ' + this._fontColor + '; border: ' +
                        this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                        '; border-top: none; padding: 0px 4px 0px 4px; font-weight: bold; border-radius: 12px 12px 12px 12px;';
         else
            newStyle = 'background-color: ' + _colorBox + '; color: ' + this._fontColor + '; border: ' +
                        this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                        '; padding: 0px 4px 0px 4px; font-weight: bold; border-radius: 12px 12px 12px 12px;';
      } else {
         if(this._themeStaples != "none")
            newStyle = 'border-top: none; padding-top: 0px;';
         else
            newStyle = '';
         let defColor = new Clutter.Color().to_string();
         boxColor = themeNode.get_color('background-color').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-color: ' + remplaceColor + ';';
         }
         boxColor = themeNode.get_color('background-gradient-start').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-gradient-start: ' + remplaceColor + ';';
         }
         boxColor = themeNode.get_color('background-gradient-end').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-gradient-end: ' + remplaceColor + ';';
         }
      }
      if(newStyle != this.rootBox.get_style()) {
         //Main.notify("newStyle:" + newStyle);
         this.rootBox.set_style(newStyle);
      }
   },

   _onOpacityTextChange: function() {
      let newStyle = '';
      if(this._overrideTheme) {
         let _colorText = (this._textBoxColor.replace(')',',' + this._opacityBoxes + ')')).replace('rgb','rgba');
         newStyle = 'background-color: ' + _colorText + '; background:' + _colorText + ';';
      } else {
         let themeNode = this.textBox.get_theme_node();
         let defColor = new Clutter.Color().to_string();
         boxColor = themeNode.get_color('background-color').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-color: ' + remplaceColor + ';';
         }
         boxColor = themeNode.get_color('background-gradient-start').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-gradient-start: ' + remplaceColor + ';';
         }
         boxColor = themeNode.get_color('background-gradient-end').to_string();
         if(defColor != boxColor) {
            remplaceColor = this.updateOpacityColor(boxColor);
            newStyle += ' background-gradient-end: ' + remplaceColor + ';';
         }
      }
      if(newStyle != this.textBox.get_style()) {
         //Main.notify("newStyle:" + newStyle);
         this.textBox.set_style(newStyle);
      }
   },

   updateOpacityColor: function(color) {
      let r = parseInt(color.substring(1,3),16);
      let g = parseInt(color.substring(3,5),16);
      let b = parseInt(color.substring(5,7),16);
      //let a = parseInt(color.substring(7,9),16);
      return "rgba("+r+","+g+","+b+","+(this._opacityBoxes)+")";
   },

   _onFixWidth: function() {
      this.fixWidth(this._fWidth);
   },

   _onFixHeight: function() {
      this.fixHeight(this._fHeight);
   },

   _onScrollVisibleChange: function() {
      this.scrollArea.get_vscroll_bar().visible = this._scrollVisible;
   },

   _onScrollAutoChange: function() {
      this.scrollArea.set_auto_scrolling(this._scrollAuto);
   },

   _onTextSetting: function() {
      this.entry.text = this._text;
      this.titleNote.set_text(this.entry.text);
   },

   _onThemePencilChange: function() {
   },

   _onAutoHideButtons: function() {
      if(this._autohideButtons) {
         this.buttonBanner.visible = false;
         if(this.autoHideButtonsIDSignal == 0) {
            this.autoHideButtonsIDSignal = this.mainBox.connect('notify::hover', Lang.bind(this, function(actor) {
               let focusedActor = global.stage.get_key_focus();
               if((focusedActor)&&(this.entry.contains(focusedActor)))
                  this.buttonBanner.visible = true;
               else
                  this.buttonBanner.visible = actor.get_hover();
            }));
         }
      } else {
         if(this.autoHideButtonsIDSignal > 0)
            this.mainBox.disconnect(this.autoHideButtonsIDSignal);
         this.autoHideButtonsIDSignal = 0;
         this.buttonBanner.visible = true;
      }
   },

   _onHideTextBox: function() {
      if(this._multInstance) {
         if((this.noteCurrent > 0)&&(this.noteCurrent < this.notesList.length + 1)) {
            this._readListHideTextBox();
            let hideNote = this.hideTextBox["" + this.notesList[this.noteCurrent - 1][0]];
            if(hideNote)
               this._onVisibleNoteChange(this.minimizeButton);
            else
               this._onVisibleNoteChange(this.maximizeButton);
         }
      } else {
         if(this._hideTextBox)
            this._onVisibleNoteChange(this.minimizeButton);
         else
            this._onVisibleNoteChange(this.maximizeButton);
      }    
   }, 

   _initSettings: function() {
      try {
         this.settings = new Settings.DeskletSettings(this, this.uuid, this.instance_id);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "multi-instance", "_multInstance", this._onMultInstanceChange, null);
         //this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "text", "_text", this._onTextSetting, null);
         /*"text": {
      "type": "entry",
      "default": "",
      "description": "Text current note:",
      "tooltip": "The current note."
       },*/
         this.settings.bindProperty(Settings.BindingDirection.IN, "stripe-layout", "_themeStripe", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "staples-layout", "_themeStaples", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "pencil-layout", "_themePencil", this._onThemePencilChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "auto-hide-buttons", "_autohideButtons", this._onAutoHideButtons, null);

         this.settings.bindProperty(Settings.BindingDirection.IN, "fix-width", "_fWidth", this._onFixWidth, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "width", "_width", this._onFixWidth, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fix-height", "_fHeight", this._onFixHeight, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "height", "_height", this._onFixHeight, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "show-scroll", "_scrollVisible", this._onScrollVisibleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "auto-scroll", "_scrollAuto", this._onScrollAutoChange, null);

         this.settings.bindProperty(Settings.BindingDirection.IN, "text-size", "_textSize", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "font-family", "_fontFamily", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "desklet-opacity", "_opacityDesklet", this._onOpacityDeskletChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "boxes-opacity", "_opacityBoxes", this._onOpacityBoxesChange, null);

         this.settings.bindProperty(Settings.BindingDirection.IN, "override-theme", "_overrideTheme", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "main-box-color", "_boxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "text-box-color", "_textBoxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "selected-text-color", "_textSelectedColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "font-color", "_fontColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "override-text-box", "_overrideTextBox", this._onStyleChange, null);

         this.settings.bindProperty(Settings.BindingDirection.IN, "border-box-width", "_borderBoxWidth", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "border-box-color", "_borderBoxColor", this._onStyleChange, null);

         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "position-x", "_xPosition", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "position-y", "_yPosition", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "list-position", "_listPosition", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "hide-text-box", "_hideTextBox", null, null);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "list-hide-text-box", "_listHideTextBox", null, null);
      } catch (e) {
         this.showErrorMessage(e.message);
         global.logError(e);
      }
   },

   _onDragEnd: function() {
      global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
      this._trackMouse();
      this._saveDeskletPosition();
   },

   _readListPosition: function() {
      this.positions = new Array();
      let pos = 0;
      let posString;
      let listString = this._listPosition.split(";;");
      while(pos < listString.length) {
         if(listString[pos] != "") {
            posString = listString[pos].split("::");
            if(this.isNoteInList(posString[0])) {
               this.positions[posString[0]] = [posString[1], posString[2]];
            }
         }
         pos++;
      }
   },

   _writeListPosition: function() {
      let stringList = "";
      for(key in this.positions) {
         if(this.isNoteInList(key))
            stringList += key + "::" + this.positions[key][0] + "::" + this.positions[key][1] + ";;";
      }
      this._listPosition = stringList.substring(0, stringList.length - 2);//commit
   },

   _saveDeskletPosition: function() {
try {
      let [ax, ay] = this.actor.get_transformed_position();
      if(this._multInstance) {
         if((this.noteCurrent > 0)&&(this.noteCurrent < this.notesList.length + 1)) {
            this._readListPosition();
            let strNote = "" + this.notesList[this.noteCurrent - 1][0];
            this.positions[strNote] = [ax, ay];
            this._writeListPosition();
         }
      } else { 
         this._xPosition = ax;
         this._yPosition = ay;
      }
} catch(e) {
  Main.notify("errorPosition", e.message);
}
   },

   _readListHideTextBox: function() {
      this.hideTextBox = new Array();
      let pos = 0;
      let hideString;
      let listString = this._listHideTextBox.split(";;");
      while(pos < listString.length) {
         if(listString[pos] != "") {
            hideString = listString[pos].split("::");
            if(this.isNoteInList(hideString[0])) {
               this.hideTextBox[hideString[0]] = (hideString[1] === 'true');
            }
         }
         pos++;
      }
   },

   _writeListHideTextBox: function() {
      let stringList = "";
      for(key in this.hideTextBox) {
         if(this.isNoteInList(key)) {
            if(this.hideTextBox[key])
               stringList += key + "::true;;";
            else
               stringList += key + "::false;;";
         }
      }
      this._listHideTextBox = stringList.substring(0, stringList.length - 2);//commit
   },

   _changeHideTextBox: function(value) {
      if(this._multInstance) {
         if((this.noteCurrent > 0)&&(this.noteCurrent < this.notesList.length + 1)) {
            this._readListHideTextBox();
            let strNote = "" + this.notesList[this.noteCurrent - 1][0];
            this.hideTextBox[strNote] = value;
            this._writeListHideTextBox();
         }
      }      
      else {
         this._hideTextBox = value;
      }
   },

/*
_onResizeMotionEvent: function(actor, event) {
      if(!this.actorResize) {
         let [mx, my] = event.get_coords();
         let [ax, ay] = actor.get_transformed_position();
         let ar = ax + actor.get_width();
         let at = ay + actor.get_height();
         if(this._isInsideMenu(mx, my, ax, ay, ar, at)) {
            if(this._correctPlaceResize(mx, my, ax, ay, ar, at)) {
               this._cursorChanged = true;
               global.set_cursor(Cinnamon.Cursor.DND_MOVE);
            } else if(this._cursorChanged) {
               this._cursorChanged = false;
               global.unset_cursor();
            }
         } else if(this._cursorChanged) {
            this._cursorChanged = false;
            global.unset_cursor();
         }
      }
   },

   _onBeginResize: function(actor, event) {
      this.actorResize = actor;
      let [mx, my] = event.get_coords();
      let [ax, ay] = actor.get_transformed_position();
      let aw = actor.get_width();
      let ah = actor.get_height();
      if(this._isInsideMenu(mx, my, ax, ay, aw, ah)) {
         if(this._correctPlaceResize(mx, my, ax, ay, aw, ah)) {
            this._findMouseDeltha();
            global.set_cursor(Cinnamon.Cursor.DND_MOVE);
            this._doResize();
         }
      }
   },

   _findMouseDeltha: function(mx, my) {
      if(this.actorResize) {
         this.mouseDx = 0;
         this.mouseDy = 0;
            this._updatePosResize();
         this.mouseDx = this.width - this.mainBox.get_width();
         this.mouseDy = this.height - this.mainBox.get_height();
      }
      
   },

   _disableResize: function() {
      this.actorResize = null;
      global.unset_cursor();
   },

   _disableOverResizeIcon: function() {
      if(!this.actorResize) {
         this._disableResize();
      }
   },

   _isInsideMenu: function(mx, my, ax, ay, aw, ah) {
      return ((this.controlingSize)&&(mx > ax)&&(mx < ax + aw)&&(my > ay)&&(my < ay + ah));
   },

   _correctPlaceResize: function(mx, my, ax, ay, aw, ah) {
      let monitor = Main.layoutManager.findMonitorForActor(this.actor);
      let middelScreen = (monitor.x + monitor.width)/2;
      let [cx, cy] = this.actor.get_transformed_position();
      switch (this.orientation) {
         case St.Side.TOP:
            if(my > ah - this.deltaMinResize) {
               if(cx > middelScreen)
                  return (mx < ax + this.deltaMinResize);
               return (mx > aw - this.deltaMinResize);
            }
            return false;
         case St.Side.BOTTOM:
            if(my < ay + this.deltaMinResize) {
               if(cx < middelScreen)
                  return (mx > aw - this.deltaMinResize);
               return  (mx < ax + this.deltaMinResize);
            }
            return false;
      }
      return false;
   },

   _doResize: function() {
      if(this.actorResize) {
         this._updatePosResize();
         this._updateSize();
         Mainloop.timeout_add(300, Lang.bind(this, this._doResize));
      }
   },

   _updatePosResize: function() {
      if(this.actorResize) {
         let [mx, my, mask] = global.get_pointer();
         let [ax, ay] = this.actorResize.get_transformed_position();
         aw = this.actorResize.get_width();
         ah = this.actorResize.get_height();
         let monitor = Main.layoutManager.findMonitorForActor(this.actor);
         let middelScreen = (monitor.x + monitor.width)/2;
         let [cx, cy] = this.actor.get_transformed_position();
         switch (this.orientation) {
            case St.Side.TOP:
               this.height = this.mainBox.get_height() + my - this._processPanelSize(false) - ah + 4 - this.mouseDy;
               if(cx < middelScreen)
                  this.width = mx - ax - this.mouseDx;
               else
                  this.width = this.mainBox.get_width() + ax - mx - this.mouseDx;
               break;
            case St.Side.BOTTOM:
               this.height = this.mainBox.get_height() + ay - my + 4 - this.mouseDy;
               if(cx < middelScreen)
                  this.width = mx - ax - this.mouseDx;
               else
                  this.width = this.mainBox.get_width() + ax - mx - this.mouseDx;
               break;
         }
      }
   },
*/
   renderFontFamily: function() {
      try {
         let fontMap = Clutter.get_font_map();
         let listFamily = fontMap.list_families();
         let patch = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/settings-schema.json";
         let new_json = JSON.parse(Cinnamon.get_file_contents_utf8_sync(patch));
         let fontItem, lengthItem, family;
         for(let key in new_json) {
            if((key == "fontFamily")&&(new_json[key]["type"] == "combobox")) {
               fontItem = new_json[key]["options"];
              // if((!fontItem)||(fontItem.length == 0)) {
                  for(let fPos in listFamily) {
                     family = listFamily[fPos].get_name();
                     //if(GLib.utf8_validate("utf-8"))
                       //  if(g_utf8_validate(family))
                        new_json[key]["options"][family] = family;
                  }
              // }
            }
         }
         let raw_file = JSON.stringify(new_json, null, 4);
         let file = Gio.file_new_for_path(patch);
         if(file.delete(null, null)) {
            let fp = file.create(0, null);
            fp.write(raw_file, null);
            fp.close;
         } else {
            //global.logError("Failed gain write access to settings file for applet/desklet '" + this.uuid + "', instance ") + this.instanceId;
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   },

   execInstallLanguage: function() {
      try {
         let _shareFolder = GLib.get_home_dir() + "/.local/share/";
         let _localeFolder = Gio.file_new_for_path(_shareFolder + "locale/");
         let _moFolder = Gio.file_new_for_path(_shareFolder + "cinnamon/desklets/" + this.uuid + "/locale/mo/");

         let children = _moFolder.enumerate_children('standard::name,standard::type',
                                          Gio.FileQueryInfoFlags.NONE, null);
         let info, child, _moFile, _moLocale, _moPath;
                   
         while ((info = children.next_file(null)) != null) {
            let type = info.get_file_type();
            if (type == Gio.FileType.REGULAR) {
               _moFile = info.get_name();
               if (_moFile.substring(_moFile.lastIndexOf(".")) == ".mo") {
                  _moLocale = _moFile.substring(0, _moFile.lastIndexOf("."));
                  _moPath = _localeFolder.get_path() + "/" + _moLocale + "/LC_MESSAGES/";
                  let src = Gio.file_new_for_path(String(_moFolder.get_path() + "/" + _moFile));
                  let dest = Gio.file_new_for_path(String(_moPath + this.uuid + ".mo"));
                  try {
                     //if(!this.equalsFile(dest.get_path(), src.get_path())) {
                        this._makeDirectoy(dest.get_parent());
                        src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                     //}
                  } catch(e) {
                     this.showErrorMessage(e.message);
                  }
               }
            }
         }
      } catch(e) {
         this.showErrorMessage(e.message);
      }
   }
};

function main(metadata, desklet_id) {
   let desklet = new MyDesklet(metadata, desklet_id);
   return desklet;
}
