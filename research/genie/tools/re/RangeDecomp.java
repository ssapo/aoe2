import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.app.cmd.disassemble.DisassembleCommand;
import ghidra.app.cmd.function.CreateFunctionCmd;
import java.io.*;
import java.util.*;
public class RangeDecomp extends GhidraScript {
  public void run() throws Exception {
    String[] a=getScriptArgs();
    String listFile=a[0], outFile=a[1];
    long base=currentProgram.getImageBase().getOffset();
    List<long[]> fl=new ArrayList<>();
    BufferedReader br=new BufferedReader(new FileReader(listFile)); String ln;
    while((ln=br.readLine())!=null){ln=ln.trim(); if(ln.isEmpty())continue; String[] p=ln.split("\\s+"); fl.add(new long[]{Long.parseLong(p[0],16),Long.parseLong(p[1],16), p.length>2?Long.parseLong(p[2]):1});}
    br.close();
    AddressSpace sp=currentProgram.getAddressFactory().getDefaultAddressSpace();
    for(long[] f:fl){ Address s=sp.getAddress(base+f[0]);
      if(getInstructionAt(s)==null){ new DisassembleCommand(s,null,true).applyTo(currentProgram,monitor);} }
    for(long[] f:fl){ Address s=sp.getAddress(base+f[0]);
      if(getFunctionAt(s)==null){ new CreateFunctionCmd(s).applyTo(currentProgram,monitor);} }
    DecompInterface di=new DecompInterface(); di.openProgram(currentProgram);
    PrintWriter pw=new PrintWriter(new FileWriter(outFile)); int n=0;
    for(long[] f:fl){ if(f[2]==0)continue; Address s=sp.getAddress(base+f[0]); Function fn=getFunctionAt(s);
      if(fn==null){pw.println("/* no function at "+s+" */");continue;}
      DecompileResults r=di.decompileFunction(fn,120,monitor);
      pw.println("/* ==== RVA 0x"+Long.toHexString(f[0])+" size 0x"+Long.toHexString(f[1]-f[0])+" ==== */");
      if(r!=null&&r.decompileCompleted()){pw.println(r.getDecompiledFunction().getC());n++;} else pw.println("/* decompile failed: "+(r==null?"null":r.getErrorMessage())+" */");
      pw.flush(); }
    pw.println("/* exported "+n+" functions */"); pw.close();
  }
}
