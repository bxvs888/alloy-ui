/*
Copyright (c) 2010, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://developer.yahoo.com/yui/license.html
version: 3.6.0
build: 3.6.0
*/
YUI.add("app-transitions",function(b){function a(){}a.ATTRS={transitions:{setter:"_setTransitions",value:false}};a.FX={fade:{viewIn:"app:fadeIn",viewOut:"app:fadeOut"},slideLeft:{viewIn:"app:slideLeft",viewOut:"app:slideLeft"},slideRight:{viewIn:"app:slideRight",viewOut:"app:slideRight"}};a.prototype={transitions:{navigate:"fade",toChild:"slideLeft",toParent:"slideRight"},_setTransitions:function(d){var c=this.transitions;if(d&&d===true){return b.merge(c);}return d;}};b.App.Transitions=a;b.Base.mix(b.App,[a]);b.mix(b.App.CLASS_NAMES,{transitioning:b.ClassNameManager.getClassName("app","transitioning")});},"3.6.0",{requires:["app-base"]});