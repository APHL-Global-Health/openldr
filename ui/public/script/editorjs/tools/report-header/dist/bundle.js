!function(t,e){"object"==typeof exports&&"object"==typeof module?module.exports=e():"function"==typeof define&&define.amd?define([],e):"object"==typeof exports?exports.ReportHeader=e():t.ReportHeader=e()}(window,function(){return function(t){var e={};function n(r){if(e[r])return e[r].exports;var i=e[r]={i:r,l:!1,exports:{}};return t[r].call(i.exports,i,i.exports,n),i.l=!0,i.exports}return n.m=t,n.c=e,n.d=function(t,e,r){n.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:r})},n.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},n.t=function(t,e){if(1&e&&(t=n(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var r=Object.create(null);if(n.r(r),Object.defineProperty(r,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var i in t)n.d(r,i,function(e){return t[e]}.bind(null,i));return r},n.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return n.d(e,"a",e),e},n.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},n.p="/",n(n.s=0)}([function(t,e,n){function r(t){return function(t){if(Array.isArray(t)){for(var e=0,n=new Array(t.length);e<t.length;e++)n[e]=t[e];return n}}(t)||function(t){if(Symbol.iterator in Object(t)||"[object Arguments]"===Object.prototype.toString.call(t))return Array.from(t)}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance")}()}function i(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}n(1).toString();var o=function(){function t(e){var n=e.data,r=(e.config,e.api),i=e.readOnly;!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this.api=r,this.readOnly=i,this.blockIndex=this.api.blocks.getCurrentBlockIndex()+1,this.CSS={baseClass:this.api.styles.block,loading:this.api.styles.loader,input:this.api.styles.input,settingsButton:this.api.styles.settingsButton,settingsButtonActive:this.api.styles.settingsButtonActive,wrapper:"cdx-report-header",imageHolder:"cdx-report-header__picture",caption:"cdx-report-header__caption"},this.nodes={wrapper:null,imageHolder:null,image:null,caption:null},this.data={url:n.url||"",captions:n.captions||[],withBorder:void 0!==n.withBorder&&n.withBorder,withBackground:void 0!==n.withBackground&&n.withBackground,stretched:void 0!==n.stretched&&n.stretched},this.settings=[{name:"withBorder",icon:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M15.8 10.592v2.043h2.35v2.138H15.8v2.232h-2.25v-2.232h-2.4v-2.138h2.4v-2.28h2.25v.237h1.15-1.15zM1.9 8.455v-3.42c0-1.154.985-2.09 2.2-2.09h4.2v2.137H4.15v3.373H1.9zm0 2.137h2.25v3.325H8.3v2.138H4.1c-1.215 0-2.2-.936-2.2-2.09v-3.373zm15.05-2.137H14.7V5.082h-4.15V2.945h4.2c1.215 0 2.2.936 2.2 2.09v3.42z"/></svg>'},{name:"stretched",icon:'<svg width="17" height="10" viewBox="0 0 17 10" xmlns="http://www.w3.org/2000/svg"><path d="M13.568 5.925H4.056l1.703 1.703a1.125 1.125 0 0 1-1.59 1.591L.962 6.014A1.069 1.069 0 0 1 .588 4.26L4.38.469a1.069 1.069 0 0 1 1.512 1.511L4.084 3.787h9.606l-1.85-1.85a1.069 1.069 0 1 1 1.512-1.51l3.792 3.791a1.069 1.069 0 0 1-.475 1.788L13.514 9.16a1.125 1.125 0 0 1-1.59-1.591l1.644-1.644z"/></svg>'},{name:"withBackground",icon:'<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.043 8.265l3.183-3.183h-2.924L4.75 10.636v2.923l4.15-4.15v2.351l-2.158 2.159H8.9v2.137H4.7c-1.215 0-2.2-.936-2.2-2.09v-8.93c0-1.154.985-2.09 2.2-2.09h10.663l.033-.033.034.034c1.178.04 2.12.96 2.12 2.089v3.23H15.3V5.359l-2.906 2.906h-2.35zM7.951 5.082H4.75v3.201l3.201-3.2zm5.099 7.078v3.04h4.15v-3.04h-4.15zm-1.1-2.137h6.35c.635 0 1.15.489 1.15 1.092v5.13c0 .603-.515 1.092-1.15 1.092h-6.35c-.635 0-1.15-.489-1.15-1.092v-5.13c0-.603.515-1.092 1.15-1.092z"/></svg>'}]}var e,n,o;return e=t,o=[{key:"sanitize",get:function(){return{url:{},withBorder:{},withBackground:{},stretched:{},captions:[]}}},{key:"isReadOnlySupported",get:function(){return!0}},{key:"pasteConfig",get:function(){return{patterns:{image:/https?:\/\/\S+\.(gif|jpe?g|tiff|png|webp)$/i},tags:["img"],files:{mimeTypes:["image/*"]}}}}],(n=[{key:"render",value:function(){var t=this,e=this._make("div",[this.CSS.baseClass,this.CSS.wrapper,"w-full"]),n=this._make("div",this.CSS.loading),i=this._make("div",this.CSS.imageHolder),o=this._make("img");e.style="position:relative";var a=this._make("div",["w-full","h-full"]);return this.data.captions.forEach(function(e){var n=e.classes||[];a.appendChild(t._make(e.tag,[t.CSS.caption].concat(r(n)),{contentEditable:!t.readOnly,style:e.style||"",innerHTML:e.info||""}))}),e.appendChild(n),this.data.url&&(o.src=this.data.url),o.onload=function(){e.classList.remove(t.CSS.loading),i.appendChild(o),e.appendChild(i),e.appendChild(a),n.remove(),t._acceptTuneView()},o.onerror=function(t){console.log("Failed to load an image",t)},this.nodes.imageHolder=i,this.nodes.wrapper=e,this.nodes.image=o,this.data.captions.forEach(function(e,n){t.nodes["caption"+n]=e}),e}},{key:"save",value:function(t){var e=t.querySelector("img"),n=t.querySelector("."+this.CSS.caption);return e?Object.assign(this.data,{url:e.src,captions:n}):this.data}},{key:"onDropHandler",value:function(t){var e=new FileReader;return e.readAsDataURL(t),new Promise(function(n){e.onload=function(e){n({url:e.target.result,captions:t.name})}})}},{key:"onPaste",value:function(t){var e=this;switch(t.type){case"tag":var n=t.detail.data;this.data={url:n.src};break;case"pattern":var r=t.detail.data;this.data={url:r};break;case"file":var i=t.detail.file;this.onDropHandler(i).then(function(t){e.data=t})}}},{key:"renderSettings",value:function(){var t=this,e=document.createElement("div");return this.settings.forEach(function(n){var r=document.createElement("div");r.classList.add(t.CSS.settingsButton),r.innerHTML=n.icon,r.addEventListener("click",function(){t._toggleTune(n.name),r.classList.toggle(t.CSS.settingsButtonActive)}),r.classList.toggle(t.CSS.settingsButtonActive,t.data[n.name]),e.appendChild(r)}),e}},{key:"_make",value:function(t){var e,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null,i=arguments.length>2&&void 0!==arguments[2]?arguments[2]:{},o=document.createElement(t);Array.isArray(n)?(e=o.classList).add.apply(e,r(n)):n&&o.classList.add(n);for(var a in i)o[a]=i[a];return o}},{key:"_toggleTune",value:function(t){this.data[t]=!this.data[t],this._acceptTuneView()}},{key:"_acceptTuneView",value:function(){var t=this;this.settings.forEach(function(e){t.nodes.imageHolder.classList.toggle(t.CSS.imageHolder+"--"+e.name.replace(/([A-Z])/g,function(t){return"-".concat(t[0].toLowerCase())}),!!t.data[e.name]),"stretched"===e.name&&t.api.blocks.stretchBlock(t.blockIndex,!!t.data.stretched)})}},{key:"data",get:function(){return this._data},set:function(t){var e=this;this._data=Object.assign({},this.data,t),this.nodes.image&&(this.nodes.image.src=this.data.url),this.nodes.captions&&this.data.captions.forEach(function(t,n){e.nodes["caption"+n]=t})}}])&&i(e.prototype,n),o&&i(e,o),t}();t.exports=o},function(t,e,n){var r=n(2);"string"==typeof r&&(r=[[t.i,r,""]]);var i={hmr:!0,transform:void 0,insertInto:void 0};n(4)(r,i);r.locals&&(t.exports=r.locals)},function(t,e,n){(t.exports=n(3)(!1)).push([t.i,".cdx-report-header {\r\n\tdisplay: inline-flex;\r\n\twidth: 100%;\r\n}\r\n\r\n.cdx-report-header .cdx-loader {\r\n  min-height: 200px;\r\n}\r\n\r\n.cdx-report-header .cdx-input {\r\n  margin-top: 0px;\r\n}\r\n\r\n.cdx-report-header img {\r\n  max-width: 100%;\r\n  vertical-align: bottom;\r\n}\r\n\r\n.cdx-report-header__caption[contentEditable=true][data-placeholder]:empty::before {\r\n  position: absolute;\r\n  content: attr(data-placeholder);\r\n  color: #707684;\r\n  font-weight: normal;\r\n  opacity: 0;\r\n }\r\n\r\n.cdx-report-header__caption[contentEditable=true][data-placeholder]:empty::before {\r\n  opacity: 1;\r\n}\r\n\r\n.cdx-report-header__caption[contentEditable=true][data-placeholder]:empty:focus::before {\r\n  opacity: 0;\r\n}\r\n\r\n\r\n.cdx-report-header__picture--with-background {\r\n  background: #eff2f5;\r\n  padding: 10px;\r\n}\r\n\r\n.cdx-report-header__picture--with-background img {\r\n  display: block;\r\n  max-width: 60%;\r\n  margin: 0 auto;\r\n}\r\n\r\n.cdx-report-header__picture--with-border {\r\n  border: 1px solid #e8e8eb;\r\n  padding: 1px;\r\n}\r\n\r\n.cdx-report-header__picture--stretched img {\r\n  max-width: none;\r\n  width: 100%;\r\n}\r\n",""])},function(t,e){t.exports=function(t){var e=[];return e.toString=function(){return this.map(function(e){var n=function(t,e){var n=t[1]||"",r=t[3];if(!r)return n;if(e&&"function"==typeof btoa){var i=(a=r,"/*# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(a))))+" */"),o=r.sources.map(function(t){return"/*# sourceURL="+r.sourceRoot+t+" */"});return[n].concat(o).concat([i]).join("\n")}var a;return[n].join("\n")}(e,t);return e[2]?"@media "+e[2]+"{"+n+"}":n}).join("")},e.i=function(t,n){"string"==typeof t&&(t=[[null,t,""]]);for(var r={},i=0;i<this.length;i++){var o=this[i][0];"number"==typeof o&&(r[o]=!0)}for(i=0;i<t.length;i++){var a=t[i];"number"==typeof a[0]&&r[a[0]]||(n&&!a[2]?a[2]=n:n&&(a[2]="("+a[2]+") and ("+n+")"),e.push(a))}},e}},function(t,e,n){var r,i,o={},a=(r=function(){return window&&document&&document.all&&!window.atob},function(){return void 0===i&&(i=r.apply(this,arguments)),i}),s=function(t){var e={};return function(t){if("function"==typeof t)return t();if(void 0===e[t]){var n=function(t){return document.querySelector(t)}.call(this,t);if(window.HTMLIFrameElement&&n instanceof window.HTMLIFrameElement)try{n=n.contentDocument.head}catch(t){n=null}e[t]=n}return e[t]}}(),c=null,l=0,d=[],u=n(5);function p(t,e){for(var n=0;n<t.length;n++){var r=t[n],i=o[r.id];if(i){i.refs++;for(var a=0;a<i.parts.length;a++)i.parts[a](r.parts[a]);for(;a<r.parts.length;a++)i.parts.push(y(r.parts[a],e))}else{var s=[];for(a=0;a<r.parts.length;a++)s.push(y(r.parts[a],e));o[r.id]={id:r.id,refs:1,parts:s}}}}function f(t,e){for(var n=[],r={},i=0;i<t.length;i++){var o=t[i],a=e.base?o[0]+e.base:o[0],s={css:o[1],media:o[2],sourceMap:o[3]};r[a]?r[a].parts.push(s):n.push(r[a]={id:a,parts:[s]})}return n}function h(t,e){var n=s(t.insertInto);if(!n)throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");var r=d[d.length-1];if("top"===t.insertAt)r?r.nextSibling?n.insertBefore(e,r.nextSibling):n.appendChild(e):n.insertBefore(e,n.firstChild),d.push(e);else if("bottom"===t.insertAt)n.appendChild(e);else{if("object"!=typeof t.insertAt||!t.insertAt.before)throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");var i=s(t.insertInto+" "+t.insertAt.before);n.insertBefore(e,i)}}function v(t){if(null===t.parentNode)return!1;t.parentNode.removeChild(t);var e=d.indexOf(t);e>=0&&d.splice(e,1)}function g(t){var e=document.createElement("style");return void 0===t.attrs.type&&(t.attrs.type="text/css"),m(e,t.attrs),h(t,e),e}function m(t,e){Object.keys(e).forEach(function(n){t.setAttribute(n,e[n])})}function y(t,e){var n,r,i,o;if(e.transform&&t.css){if(!(o=e.transform(t.css)))return function(){};t.css=o}if(e.singleton){var a=l++;n=c||(c=g(e)),r=x.bind(null,n,a,!1),i=x.bind(null,n,a,!0)}else t.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(n=function(t){var e=document.createElement("link");return void 0===t.attrs.type&&(t.attrs.type="text/css"),t.attrs.rel="stylesheet",m(e,t.attrs),h(t,e),e}(e),r=function(t,e,n){var r=n.css,i=n.sourceMap,o=void 0===e.convertToAbsoluteUrls&&i;(e.convertToAbsoluteUrls||o)&&(r=u(r));i&&(r+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(i))))+" */");var a=new Blob([r],{type:"text/css"}),s=t.href;t.href=URL.createObjectURL(a),s&&URL.revokeObjectURL(s)}.bind(null,n,e),i=function(){v(n),n.href&&URL.revokeObjectURL(n.href)}):(n=g(e),r=function(t,e){var n=e.css,r=e.media;r&&t.setAttribute("media",r);if(t.styleSheet)t.styleSheet.cssText=n;else{for(;t.firstChild;)t.removeChild(t.firstChild);t.appendChild(document.createTextNode(n))}}.bind(null,n),i=function(){v(n)});return r(t),function(e){if(e){if(e.css===t.css&&e.media===t.media&&e.sourceMap===t.sourceMap)return;r(t=e)}else i()}}t.exports=function(t,e){if("undefined"!=typeof DEBUG&&DEBUG&&"object"!=typeof document)throw new Error("The style-loader cannot be used in a non-browser environment");(e=e||{}).attrs="object"==typeof e.attrs?e.attrs:{},e.singleton||"boolean"==typeof e.singleton||(e.singleton=a()),e.insertInto||(e.insertInto="head"),e.insertAt||(e.insertAt="bottom");var n=f(t,e);return p(n,e),function(t){for(var r=[],i=0;i<n.length;i++){var a=n[i];(s=o[a.id]).refs--,r.push(s)}t&&p(f(t,e),e);for(i=0;i<r.length;i++){var s;if(0===(s=r[i]).refs){for(var c=0;c<s.parts.length;c++)s.parts[c]();delete o[s.id]}}}};var b,w=(b=[],function(t,e){return b[t]=e,b.filter(Boolean).join("\n")});function x(t,e,n,r){var i=n?"":r.css;if(t.styleSheet)t.styleSheet.cssText=w(e,i);else{var o=document.createTextNode(i),a=t.childNodes;a[e]&&t.removeChild(a[e]),a.length?t.insertBefore(o,a[e]):t.appendChild(o)}}},function(t,e){t.exports=function(t){var e="undefined"!=typeof window&&window.location;if(!e)throw new Error("fixUrls requires window.location");if(!t||"string"!=typeof t)return t;var n=e.protocol+"//"+e.host,r=n+e.pathname.replace(/\/[^\/]*$/,"/");return t.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,function(t,e){var i,o=e.trim().replace(/^"(.*)"$/,function(t,e){return e}).replace(/^'(.*)'$/,function(t,e){return e});return/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(o)?t:(i=0===o.indexOf("//")?o:0===o.indexOf("/")?n+o:r+o.replace(/^\.\//,""),"url("+JSON.stringify(i)+")")})}}])});