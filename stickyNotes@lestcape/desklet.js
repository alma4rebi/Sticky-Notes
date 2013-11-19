// Desklet : Sticky Notes           Version      : v0.7-Beta
// O.S.    : Cinnamon               Release Date : 18 November 2013.
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

      this._themeStaples = "none";
      this._themeStripe = "none";
      this._themePencil = "bluepencil";
      this._text = "";
      this.noteCurrent = 0;
      this._boxColor = "#000000";
      this._transparency = 50;
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
      this.autoHideButtonsIDSignal = 0;
      this.scrollIDSignal = 0;
      this._multInstance = false;
      try {
         this.settingsExt = Gio.Settings.new("org.cinnamon");
         this._initSettings();
         this._initDeskletContruction();
         this.setContent(this.mainBox);

         this.initDeskletType();

         this._keyFocusNotifyIDSignal = global.stage.connect('notify::key-focus', Lang.bind(this, this._onKeyFocusChanged));
         this.clutterText.connect('button-press-event', Lang.bind(this, this._onButtonPress));
         this.clutterText.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
         this.textBox.connect('button-press-event', Lang.bind(this, this._onButtonPress));
         this.textBox.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
         this.endBoxBackGround.connect('allocation_changed', Lang.bind(this, this._onAllocationChanged));

         this._onFixWidth();
         this._onFixHeight();
         this._onAutoHideButtons();
         this.multInstanceMenuItem._switch.setToggleState(this._multInstance);
         Mainloop.idle_add(Lang.bind(this, this._onStyleChange));
      } catch(e) {
         this.showErrorMessage(e.message);
      }
      this._trackMouse();
   },

   showErrorMessage: function(menssage) {
      Main.notifyError(_("Error"), menssage);
   },

   initDeskletType: function() {
      this.notesList = this.findNotesFromFile();
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
      }
      else {
         this.readNotesFromFile();
         this.loadNote(0);
      }
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
            deskletDef = (this.uuid + ':%s:%s:%s').format(newDeskletID, posX, posY);
         }
         else {
            deskletDef = (this.uuid + ':%s:0:0').format(newDeskletID);
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

   _onAddNote: function() {
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
         if(this._fHeight) {
            this.scrollArea.set_height(-1);
            this.textBox.set_height(-1);
            this.scrollBox.visible = false;
         }
         else
            this.textBox.visible = false;
      }
      else {
         this.leftBox.add(this.minimizeButton, {x_fill: true, x_align: St.Align.END});
         if(this._fHeight) {
            this.fixHeight(true);
            this.scrollBox.visible = true;
         }
         else
            this.textBox.visible = true;
      }
   },

   _onRemoveNote: function() {
      try {
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

   _onBackNote: function() {
      if(this.notesList.length != 0) {
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

   _onNextNote: function() {
      if(this.notesList.length != 0) {
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

   _onConfigNote: function() {
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
      let _color = (this._boxColor.replace(')',',' + this._transparency + ')')).replace('rgb','rgba');
      let _colorBanner = (this._boxColor.replace(')',',' + 0.1 + ')')).replace('rgb','rgba');
      if(this._themeStaples != "none") {
         this.rootBox.set_style('text-shadow: 1px 1px 2px #000; min-width: 170px; background-color: ' + _color +
                                '; box-shadow: -4px 4px 2px rgba(0, 0, 0, 0.5); color: ' + this._fontColor + '; font-weight: bold;');
         this.bannerBox.set_style('padding: 4px; background-color: ' + _colorBanner + ';');
         let imageG = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/staples/"+ this._themeStaples +"/";
         this.transpBox.set_style('background-image: url(\'' + imageG + '1.png\');' +
                                  'background-repeat: repeat; background-position: 0px 0px;');
         this.transpBox.set_height(10);
         this.endBox.set_style('background-image: url(\'' + imageG + '2.png\');' +
                               'background-repeat: repeat; background-position: 0px 0px;');
         this.endBoxBackGround.set_style('background-color: ' + _colorBanner);
         this.endBox.set_height(15);
      } else {
         this.bannerBox.set_style('padding: 4px; background-color: ' + _colorBanner + '; border-radius: 12px;');
         this.endBox.set_height(0);
         this.transpBox.set_height(0);
         this.rootBox.set_style('border: '+ this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                                '; background-color: ' + _color + '; border-radius: 12px; color: ' + this._fontColor +
                                '; text-shadow: 1px 1px 2px #000; font-weight: bold; min-width: 170px;');
      /* this.rootBox.set_style('text-shadow: 1px 1px 2px #000; min-width: 170px; background-color: ' + _color +
                                '; box-shadow: -4px 4px 2px rgba(0, 0, 0, 0.5); color: ' + this._fontColor + 
                                '; border: '+ this._borderBoxWidth + 'px solid ' + this._borderBoxColor +
                                '; border-radius: 12px; font-weight: bold;');*/
      }
      let fontTag = '';
      if((this._fontFamily)&&(this._fontFamily != ""))
         fontTag = 'font-family: ' + this._fontFamily + ';';

     // desc.set_family("Monospace"); 13
     // desc.set_family("UnPilgi"); 13
     // desc.set_family("Times New Roman"); 14

      this.entry.set_style('font-size: ' + this._textSize + 'pt; color: ' + this._fontColor +
                           '; font-weight: normal; ' + fontTag);

      if(this._themeStripe != "none") {
         let image = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/stripe/" + this._themeStripe + "/";
         let textHeight = this._getTextHeight();
         let imageNumber = Math.floor(textHeight);
         let suported = true;
         if(imageNumber != textHeight) {
            let newVal = this._textSize*imageNumber/textHeight;
            this.entry.set_style('font-size: ' + newVal + 'pt; color: ' + this._fontColor +
                                 '; font-weight: normal; ' + fontTag);
            textHeight = this._getTextHeight();
         }
         if((imageNumber < 10)||(imageNumber > 60)||(imageNumber != textHeight)) {
            this.showErrorMessage(_("Unsupported text size '%s'  to use the font '%s' in this theme.").format(this._textSize, this._fontFamily));
            this.textBox.set_style('padding: 4px; min-width: 160px;');
         } else {
            if(this._themeStaples != "none") {
               this.textBox.set_style('padding: 4px; background-image: url(\'' + image + imageNumber + '.png\');' +
                                      'background-repeat: repeat; background-position: 0px 0px; min-width: 160px;');
            } else {
               this.textBox.set_style('padding: 4px; background-image: url(\'' + image + imageNumber + '.png\');' +
                                      'background-repeat: repeat; background-position: 0px 0px; border-radius: 12px; min-width: 160px;');
            }
         }
      } else
         this.textBox.set_style('padding: 4px; min-width: 160px;');
   },

   setPencil: function(activePencil) {
      if((this._themePencil != "none")&&(activePencil)) {
         let image = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/" + this.uuid + "/pencil/" + this._themePencil + ".png";
         this.pencilBox.set_style('width: 100px; background-image: url(\'' + image + '\');');
      } else {
         this.pencilBox.set_style('width: 100px;');
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
      this.buttonBanner = new St.BoxLayout({vertical:false});
      this.leftBox = new St.BoxLayout({vertical:false});
      let centerBox = new St.BoxLayout({vertical:false});
      this.pencilBox = new St.BoxLayout({vertical:true});
      let rightBox = new St.BoxLayout({vertical:false}); 
      this.textBox = new St.BoxLayout({vertical:true, reactive: true});

      let addButton = this._buttonCreation('list-add', _("Add new Note"));
      addButton.connect('clicked', Lang.bind(this, this._onAddNote));
      this.leftBox.add(addButton, {x_fill: true, x_align: St.Align.END});

      this.minimizeButton = this._buttonCreation('go-up', _("Minimize Note"));
      this.minimizeButton.connect('clicked', Lang.bind(this, this._onVisibleNoteChange));
      this.maximizeButton = this._buttonCreation('go-down', _("Maximize Note"));
      this.maximizeButton.connect('clicked', Lang.bind(this, this._onVisibleNoteChange));
      this.leftBox.add(this.minimizeButton, {x_fill: true, x_align: St.Align.END});

      this.currentNote = new St.Label();
      this.currentNote.set_text("1");

      this.numberNote = new St.Label();
      this.numberNote.set_text("0");

      let separator = new St.Label();
      separator.set_text("/");

      this.titleNote = new St.Label();
      this.titleNote.set_text("");
      this.titleNote.set_height(16);

      let backButton = this._buttonCreation('edit-undo', _("Back Note"));
      backButton.connect('clicked', Lang.bind(this, this._onBackNote));

      let nextButton = this._buttonCreation('edit-redo', _("Next Note"));
      nextButton.connect('clicked', Lang.bind(this, this._onNextNote));

      if(!this._multInstance) {
         centerBox.add(backButton, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
         centerBox.add(this.currentNote, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
         centerBox.add(separator, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
         centerBox.add(this.numberNote, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
         centerBox.add(nextButton, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});      
      } else
         centerBox.add(this.titleNote, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.MIDDLE});
      centerBox.set_width(70);
      this.pencilBox.add(centerBox, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
      this.setPencil(false);

      let configButton = this._buttonCreation('preferences-system', _("Configure..."));
      configButton.connect('clicked', Lang.bind(this, this._onConfigNote));

      let deleteButton = this._buttonCreation('window-close', _("Remove Note"));
      deleteButton.connect('clicked', Lang.bind(this, this._onRemoveNote));
      
      rightBox.add(configButton, {x_fill: true, x_align: St.Align.END});
      rightBox.add(deleteButton, {x_fill: true, x_align: St.Align.END});

      this.buttonBanner.add(this.leftBox, {x_fill: true, x_align: St.Align.START});
      this.buttonBanner.add(this.pencilBox, {x_fill: false, expand: true, x_align: St.Align.MIDDLE});
      this.buttonBanner.add(rightBox, {x_fill: true, x_align: St.Align.END});
      this.bannerBox.set_height(20);
      this.bannerBox.add(this.buttonBanner, {x_fill: true, x_align: St.Align.MIDDLE});

      this.entry = new St.Entry({ name: 'noteEntry', hint_text: _("Type to your note..."), track_hover: false, can_focus: true});
      this.textBox.add(this.entry, {x_fill: true, y_fill: false, expand: true, x_align: St.Align.START, y_align: St.Align.START});

      this.transpBox = new St.BoxLayout({vertical:true});
      this.endBoxBackGround = new St.BoxLayout({vertical:true});
      this.endBox = new St.BoxLayout({vertical:false});
      this.endBoxBackGround.add(this.endBox, {x_fill: false, x_align: St.Align.MIDDLE});

      this.rootBox.add(this.endBoxBackGround, {x_fill: true, expand: true, x_align: St.Align.MIDDLE});
      this.rootBox.add(this.bannerBox, {x_fill: true, x_align: St.Align.START});

      this.mainBox.add(this.transpBox, {x_fill: false, x_align: St.Align.MIDDLE});
      this.mainBox.add(this.rootBox, {x_fill: true, expand: true, x_align: St.Align.START});

      this.clutterText = this.entry.clutter_text;
      this.clutterText.set_single_line_mode(false);
      this.clutterText.set_activatable(false);
      this.clutterText.set_line_wrap(true);
      this.clutterText.set_line_wrap_mode(imports.gi.Pango.WrapMode.WORD_CHAR);
      this.clutterText.set_selectable(true);
      this.clutterText.set_selected_text_color(new Clutter.Color({red : 0, blue : 155, green : 0, alpha : 255}));
//scroll
      this.scrollArea = new St.ScrollView({ name: 'note-scrollview', vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                            hscrollbar_policy: Gtk.PolicyType.NEVER, style_class: 'vfade' });

      this.scrollBox = new St.BoxLayout({vertical:false});
      this.scrollBox.add(this.scrollArea, {x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.START});
    //  this.finichBox = new St.BoxLayout({height: 10});
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
      this.scrollBox.remove_actor(this.textBox);
      this.rootBox.remove_actor(this.textBox);
      this.rootBox.remove_actor(this.scrollBox);
      //this.rootBox.remove_actor(this.finichBox);
      this.scrollArea.remove_actor(this.textBox);
      if(scrolling) {
         this.scrollArea.add_actor(this.textBox);
         this.scrollBox.add_actor(this.textBox, {x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START});
         this.rootBox.add(this.scrollBox, {x_fill: true, y_fill: true, expand: true, x_align: St.Align.START, y_align: St.Align.START});
         if(this.scrollIDSignal == 0)
            this.scrollIDSignal = this.scrollBox.connect('event', Lang.bind(this, this._scrollFilter));
      } else {
         this.rootBox.add(this.textBox, {x_fill: true, y_fill: true, expand: true, x_align: St.Align.START});
         if(this.scrollIDSignal > 0)
            this.scrollBox.disconnect(this.scrollIDSignal);
         this.scrollIDSignal = 0;
      }
     // this.rootBox.add(this.finichBox, {x_fill: true, y_fill: true, x_align: St.Align.START});
   },

   fixHeight: function(fix) {
      this._fHeight = fix;
      if(fix) {
         if(this._scrollVisible) {
            this.scrollArea.set_height(this._height);
            this.textBox.set_height(-1);
         } else {
            this.scrollArea.set_height(-1);
            this.textBox.set_height(this._height);
         }
      }
      else {
         this.scrollArea.set_height(-1);
         this.textBox.set_height(-1);
      }
      this.enableScrolling(fix);
      this.leftBox.remove_actor(this.minimizeButton);
      this.leftBox.remove_actor(this.maximizeButton);
      this.leftBox.add(this.minimizeButton, {x_fill: true, x_align: St.Align.END});
   },




   fixWidth: function(fix) {
      this._fWidth = fix;
      if(fix)
         this.entry.set_width(this._width);
      else {
         this.entry.set_width(-1);
         //this.transpBox.set_width(-1);
      }
   },

   _onAllocationChanged: function() {
      let availWidth = this.entry.get_width();
      let diff = (availWidth % 18);
     // Main.notifyError("Width: " + availWidth + " diff: " + diff);
      this.transpBox.set_width(availWidth - diff);
      this.endBox.set_width(availWidth - diff);
      //this.endBoxBackGround.set_width(availWidth - diff);
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
      if(this.autoHideButtonsIDSignal > 0)
         this.mainBox.disconnect(this.autoHideButtonsIDSignal);
      this.autoHideButtonsIDSignal = 0;
      if(this.scrollIDSignal > 0)
         this.scrollBox.disconnect(this.scrollIDSignal);
      this.scrollIDSignal = 0;
      this.settings.finalize();
   },

   _buttonCreation: function(icon, toolTip) {    
      let bttIcon = new St.Icon({ icon_name: icon,
	                          icon_type: St.IconType.SYMBOLIC,
				  style_class: 'popup-menu-icon' });
      let btt = new St.Button({ child: bttIcon });
      btt.connect('notify::hover', Lang.bind(this, function(actor) {
         if(actor.get_hover())
            global.set_cursor(Cinnamon.Cursor.POINTING_HAND);
         else
            global.unset_cursor();
      }));
      let bttTooltip = new Tooltips.Tooltip(btt, toolTip);
      return btt;
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

   _onKeyPress: function(entry, event) {
      this.symbol = event.get_key_symbol();
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

    _onMultInstanceChange: function() {
       if(this.instance_id ==  this.getMasterInstance()) {
          this.multInstanceUpdate();
          this.multInstanceMenuItem._switch.setToggleState(this._multInstance);
       }
    },

    _onStyleChange: function() {
       this.setStyle();
    },

    _onFixWidth: function() {
       this.fixWidth(this._fWidth);
    },

    _onFixHeight: function() {
       this.fixHeight(this._fHeight);
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

    _initSettings: function() {
      try {
         this.settings = new Settings.DeskletSettings(this, this.uuid, this.instance_id);
         this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "multInstance", "_multInstance", this._onMultInstanceChange, null);
         //this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "text", "_text", this._onTextSetting, null);
         /*"text": {
      "type": "entry",
      "default": "",
      "description": "Text current note:",
      "tooltip": "The current note."
       },*/
         this.settings.bindProperty(Settings.BindingDirection.IN, "stripe", "_themeStripe", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "staples", "_themeStaples", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "pencil", "_themePencil", this._onThemePencilChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "autoHideButtons", "_autohideButtons", this._onAutoHideButtons, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "boxColor", "_boxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fontColor", "_fontColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "textSize", "_textSize", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fontFamily", "_fontFamily", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "transparency", "_transparency", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "borderBoxWidth", "_borderBoxWidth", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "borderBoxColor", "_borderBoxColor", this._onStyleChange, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fixWidth", "_fWidth", this._onFixWidth, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "width", "_width", this._onFixWidth, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "fixHeight", "_fHeight", this._onFixHeight, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "height", "_height", this._onFixHeight, null);
         this.settings.bindProperty(Settings.BindingDirection.IN, "scrollVisible", "_scrollVisible", this._onFixHeight, null);
      } catch (e) {
         this.showErrorMessage(e.message);
         global.logError(e);
      }
   },

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
