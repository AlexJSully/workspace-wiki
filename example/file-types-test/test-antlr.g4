// test-antlr.g4: Simple ANTLR 4 grammar for Workspace Wiki file type testing
grammar Hello;

r   : 'hello' ID ;
ID  : [a-zA-Z]+ ;
WS  : [ \t\r\n]+ -> skip ;