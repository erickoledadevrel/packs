// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const simpletype = ([type]) => ({type});
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "field", "symbols": ["name", {"literal":"_"}, "type"], "postprocess": 
        ([name, _, type]) => Object.assign({name}, type)
        },
    {"name": "name$ebnf$1", "symbols": [/[a-zA-Z0-9_]/]},
    {"name": "name$ebnf$1", "symbols": ["name$ebnf$1", /[a-zA-Z0-9_]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "name", "symbols": ["name$ebnf$1"], "postprocess":  
        ([chars]) => chars.join("")
        },
    {"name": "type", "symbols": ["list"], "postprocess": id},
    {"name": "type", "symbols": ["onetype"], "postprocess": id},
    {"name": "list$string$1", "symbols": [{"literal":"l"}, {"literal":"i"}, {"literal":"s"}, {"literal":"t"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "list", "symbols": ["list$string$1", {"literal":"_"}, "onetype"], "postprocess":  
        ([_, __, type]) => Object.assign({list: true}, type)
        },
    {"name": "onetype", "symbols": ["option"], "postprocess": id},
    {"name": "onetype", "symbols": ["custom"], "postprocess": id},
    {"name": "onetype", "symbols": ["simpletype"], "postprocess": id},
    {"name": "option$string$1", "symbols": [{"literal":"o"}, {"literal":"p"}, {"literal":"t"}, {"literal":"i"}, {"literal":"o"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "option", "symbols": ["option$string$1", {"literal":"_"}, "name"], "postprocess": 
        ([_, __, ref]) => ({type: "option", ref})
        },
    {"name": "custom$string$1", "symbols": [{"literal":"c"}, {"literal":"u"}, {"literal":"s"}, {"literal":"t"}, {"literal":"o"}, {"literal":"m"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "custom", "symbols": ["custom$string$1", {"literal":"_"}, "name"], "postprocess": 
        ([_, __, ref]) => ({type: "custom", ref})
        },
    {"name": "simpletype$string$1", "symbols": [{"literal":"t"}, {"literal":"e"}, {"literal":"x"}, {"literal":"t"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$1"], "postprocess": simpletype},
    {"name": "simpletype$string$2", "symbols": [{"literal":"b"}, {"literal":"o"}, {"literal":"o"}, {"literal":"l"}, {"literal":"e"}, {"literal":"a"}, {"literal":"n"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$2"], "postprocess": simpletype},
    {"name": "simpletype$string$3", "symbols": [{"literal":"n"}, {"literal":"u"}, {"literal":"m"}, {"literal":"b"}, {"literal":"e"}, {"literal":"r"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$3"], "postprocess": simpletype},
    {"name": "simpletype$string$4", "symbols": [{"literal":"n"}, {"literal":"u"}, {"literal":"m"}, {"literal":"b"}, {"literal":"e"}, {"literal":"r"}, {"literal":"_"}, {"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"g"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$4"], "postprocess": simpletype},
    {"name": "simpletype$string$5", "symbols": [{"literal":"d"}, {"literal":"a"}, {"literal":"t"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$5"], "postprocess": simpletype},
    {"name": "simpletype$string$6", "symbols": [{"literal":"i"}, {"literal":"m"}, {"literal":"a"}, {"literal":"g"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$6"], "postprocess": simpletype},
    {"name": "simpletype$string$7", "symbols": [{"literal":"f"}, {"literal":"i"}, {"literal":"l"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$7"], "postprocess": simpletype},
    {"name": "simpletype$string$8", "symbols": [{"literal":"u"}, {"literal":"s"}, {"literal":"e"}, {"literal":"r"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$8"], "postprocess": simpletype},
    {"name": "simpletype$string$9", "symbols": [{"literal":"d"}, {"literal":"a"}, {"literal":"t"}, {"literal":"e"}, {"literal":"i"}, {"literal":"n"}, {"literal":"t"}, {"literal":"e"}, {"literal":"r"}, {"literal":"v"}, {"literal":"a"}, {"literal":"l"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$9"], "postprocess": simpletype},
    {"name": "simpletype$string$10", "symbols": [{"literal":"d"}, {"literal":"a"}, {"literal":"t"}, {"literal":"e"}, {"literal":"_"}, {"literal":"r"}, {"literal":"a"}, {"literal":"n"}, {"literal":"g"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "simpletype", "symbols": ["simpletype$string$10"], "postprocess": simpletype}
]
  , ParserStart: "field"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
