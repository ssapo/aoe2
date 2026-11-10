from emu2 import *
tr=['41dbb6ca 424bb255','41dbd503 424baa1c','41dbf33c 424ba1e3','41dc1175 424b99aa','41dc2fae 424b9171','41dc4de7 424b8938','41dc6c20 424b80ff','41dc8a59 424b78c6','41dca892 424b708d','41dcc6cb 424b6854']
F=[fb('3f60dc1d'),f32(0),fb('bef4bcb7')]
for name,T in (('31,49',(31,49)),('31.5,49.5',(31.5,49.5)),('30.5,48.5',(30.5,48.5)),('31,49.0',(31,49))):
    Wt=[f32(T[0]),f32(0),f32(T[1])]
    print(name,[hx(dot(direction_to([fb(t.split()[0]),f32(0),fb(t.split()[1])],Wt),F))[-4:] for t in tr])
# what target points T along/near line give dot==3f7fffff at P7 (41dc8a59) but >=1 at P1..P6 ?
