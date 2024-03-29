'use strict';

var utils = require('./utils.js');
var _ = require('lodash');

var slugger = require('uslug');

/**
 * Defines a set of functions usable in all swig templates, are merged into context on render
 * @param  {Object}   swig        Swig engine
 */
module.exports.swigFunctions = function(swig) {

  var self = this;

  this.context = {};
  this.data = {};
  this.settings = {};
  this.typeInfo = {};

  this.paginate = false;
  this.curPage = 1;
  this.maxPage = -1;
  this.pageUrl = 'page-';
  this.paginationBaseUrl = null;
  this.cachedData = {};
  this.CURRENT_URL = '/';

  /**
   * Returns a standard url for a given object, only works for standard scaffolding url structure
   * @param  {Object}   object     Object to generate url for
   * @returns {String}   Url for the object passed in
   */
  var url = function(object) {
    var slug = object.slug ? object.slug : (object.name ? slugger(object.name).toLowerCase() : null);
    var prefix = object._type ? object._type : '';

    var url = '';
    if(prefix) {
      url = '/' + prefix + '/' + slug + '/';
    } else {
      url = '/' + slug + '/';
    }

    return url;
  };

  /**
   * Sets the data set used by all the functions in this class
   * @param  {Object}   data   The data to be used by all functions in this class
   */
  this.setData = function(data) {
    self.cachedData = {};
    self.data = data;
  };

  /**
   * Sets the type info used by all the functions in this class
   * @param  {Object}   typeInfo   The type info to be used by all functions in this class
   */
  this.setTypeInfo = function(typeInfo) {
    self.typeInfo = typeInfo;
  };

  /**
   * Sets the settings used by all the functions in this class
   * @param  {Object}   settings   The settings to be used by all functions in this class
   */
  this.setSettings = function(settings) {
    self.settings = settings;
  };

  /**
   * Returns all content types for a given site
   * @returns  {Array}  An array of type object (slug and name of type)
   */
  var getTypes = function() {
    var types = [];

    for(var key in self.typeInfo) {
      if(!self.typeInfo[key].oneOff) {
        types.push({ slug: key, name: self.typeInfo[key].name });
      }
    }

    return types;
  };

  /**
   * Returns a published item based off its type and id or a relation string from the CMS
   * @param    {String} Can either be a relation string (from the CMS) or a type name
   * @param    {String} (OPTIONAL) If the first parameter was the type, this must be the ID of the item
   * @returns  {Object} The published item specified by the type/id or relation string passed in
   */
  var getItem = function(type, key) {
    if(!type) {
      return {};
    }

    if(!key) {
      if(Array.isArray(type)) {
        if(type.length > 0) {
          type = type[0];
        } else {
          return {};
        }
      }
      var parts = type.split(" ", 2);
      if(parts.length !== 2) {
        return {};
      }

      type = parts[0];
      key = parts[1];
    }
    
    if(!self.typeInfo[type]) {
      return {};
    }

    var item = self.data[type][key];

    if(!item) {
      return {};
    }

    if(!self.typeInfo[type].oneOff) {
      if(!item.publish_date) {
        return {};
      }

      var now = Date.now();
      var pdate = Date.parse(item.publish_date);

      if(pdate > now + (1 * 60 * 1000)) {
        return {};
      }
    }

    item._type = type;
    return item;
  };

  /**
   * Returns an array of items from a relation
   * @param    {Array}  An array of relation strings from the CMS
   * @returns  {Array}  All published items specified by relation strings
   */
  var getItems = function(arr) {
    if(!arr) {
      return [];
    }
    var items = [];
    arr.forEach(function(itm) {
      var obj = getItem(itm);
      if(!_.isEmpty(obj)) {
        items.push(getItem(itm));
      }
    });

    return items;
  }

  /**
   * Returns all the data specified by the arguments
   * @param    {String} Name of type to retrieve data for
   * @param    {String} (optional) Other type to return with this data, can specifiy as many types as needed
   * @returns  {Array}  All items from type (or types)
   */
  var getCombined = function() {
    var names = [].slice.call(arguments, 0);

    if(self.cachedData[names.join(',')])
    {
      return self.cachedData[names.join(',')];
    }

    // TODO, SLUG NAME THE SAME WAS CMS DOES

    var data = [];
    names.forEach(function(name) {
      var tempData = self.data[name] || {};

      if(self.typeInfo[name] && self.typeInfo[name].oneOff) {
        data = tempData;
        return;
      }

      tempData = _.omit(tempData, function(value, key) { return key.indexOf('_') === 0; });

      // convert it into an array
      tempData = _.map(tempData, function(value, key) { value._id = key; value._type = name; return value });
      tempData = _.filter(tempData, function(item) { 
        if(!item.publish_date) {
          return false;
        }

        var now = Date.now();
        var pdate = Date.parse(item.publish_date);

        if(pdate > now + (1 * 60 * 1000)) {
          return false;
        }

        return true;
      });

      data = data.concat(tempData);
    });

    
    self.cachedData[names.join(',')] = data;

    return data;
  };

  var paginate = function(data, perPage, pageName) {
    if(self.curPage === 1 && self.paginate === true)
    {
      throw new Error('Can only paginate one set of data in a template.');
    }

    var items = utils.slice(data, perPage, perPage * (self.curPage-1));
    self.paginate = true;

    if(self.paginationBaseUrl === null) {
      self.paginationBaseUrl = self.CURRENT_URL;
    }

    self.pageUrl = pageName || self.pageUrl;
    self.maxPage = Math.ceil(_(data).size() / perPage);

    return items;
  };

  var getCurPage = function() {
    return self.curPage;
  };

  var getMaxPage = function() {
    return self.maxPage;
  };

  var getPageUrl = function(pageNum) {
    if(pageNum == 1) {
      return self.paginationBaseUrl;
    }

    return self.paginationBaseUrl + self.pageUrl + pageNum + '/';
  };

  var getCurrentUrl = function() {
    return self.CURRENT_URL;
  };

  var getSetting = function(key) {
    if(!self.settings.general) {
      return null;
    }

    return self.settings.general[key];
  };

  var randomElement = function(array) {
    if(!array || !_.isArray(array)) {
      return null;
    }

    var index = [Math.floor(Math.random() * array.length)];
    return array[index];
  };

  // FUNCTIONS USED FOR PAGINATION HELPING, IGNORE FOR MOST CASES
  this.shouldPaginate = function() {
    return self.curPage <= self.maxPage;
  };

  // Reset initial data
  this.init = function() {
    self.paginate = false;
    self.curPage = 1;
    self.pageUrl = 'page-'
    self.maxPage = -1;
    self.paginationBaseUrl = null;
  };

  this.increasePage = function() {
    self.curPage = self.curPage + 1;
  };
  
  this.setParams = function(params) {
    for(var key in params) {
      self[key] = params[key];
    }
  };

  this.getFunctions = function() {
    return {
      get: getCombined,
      getItem: getItem,
      getItems: getItems,
      getTypes: getTypes,
      paginate: paginate,
      getCurPage: getCurPage,
      getMaxPage: getMaxPage,
      getPageUrl: getPageUrl,
      url: url,
      getCurrentUrl: getCurrentUrl,
      getSetting: getSetting,
      random: randomElement,
      cmsVersion: 'v2'
    };
  };


  return this;
};