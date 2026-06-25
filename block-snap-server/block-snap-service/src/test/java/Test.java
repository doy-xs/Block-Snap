import java.io.File;
import java.lang.ref.Cleaner;
import java.util.*;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Test {
    public static void main(String[] args) {
    Runnable r=new Ticket();
        r.run();
        
    }
}
class Ticket implements Runnable {
    @Override
    public void run() {
    
    }
}
