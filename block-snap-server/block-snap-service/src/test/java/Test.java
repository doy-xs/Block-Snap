import java.util.*;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Test {
    public static void main(String[] args) {
      Runnable r=new MyRunnable() ;
        
        Thread w1 = new Thread(r, "窗口1");
        Thread w2 = new Thread(r, "窗口2");
        Thread w3 = new Thread(r, "窗口3");
        
        w1.start();
        w2.start();
        w3.start();
    }
}
class MyRunnable  implements Runnable {
    int ticket=100;
    Lock lock=new ReentrantLock();
    @Override
    public void run() {
        while (true) {
        lock.lock();
            try {
                if (ticket>0) break;
            
            try{
            Thread.sleep(100);
            
            }catch (InterruptedException e){
                e.printStackTrace();
            }
            System.out.println(Thread.currentThread().getName()+"ticket:"+ticket);
            ticket--;
        }finally {
                lock.unlock();
            }
            }
    }
}
