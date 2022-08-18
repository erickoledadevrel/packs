field -> name "_" type {%
  ([name, _, type]) => Object.assign({name}, type)
%}

name -> [a-zA-Z0-9_]:+ {% 
  ([chars]) => chars.join("")
%}

type -> 
    list {% id %} 
  | onetype {% id %}

list -> "list" "_" onetype {% 
  ([_, __, type]) => Object.assign({list: true}, type)
%}

onetype -> 
    option {% id %} 
  | custom {% id %} 
  | simpletype {% id %}

option -> "option" "_" name {%
  ([_, __, ref]) => ({type: "option", ref})
%}

custom -> "custom" "_" name {%
  ([_, __, ref]) => ({type: "custom", ref})
%}

@{%
const simpletype = ([type]) => ({type});
%}

simpletype -> 
    "text" {% simpletype %}
  | "boolean" {% simpletype %}
  | "number" {% simpletype %}
  | "date" {% simpletype %}
  | "image" {% simpletype %}
  | "file" {% simpletype %}
  | "user" {% simpletype %}
  | "dateinterval" {% simpletype %}
  | "date_range" {% simpletype %}