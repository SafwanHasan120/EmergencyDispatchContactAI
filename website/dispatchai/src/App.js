
import './App.css';

function App() {
  return (
    <>
    <div class="container">
      <link href="https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&family=Outfit:wght@400;700&display=swap" rel="stylesheet"></link>
      <div class="title" href="/">DispatchAI</div>
      <div class="widget-container">
        <div class="assist">Possible ways for me to assist:</div>
        <div class="widgets">
          <div class="widget">
            <a href="#">Medical Situation Support</a>
          </div>
          <div class="widget">
            <a href="#">Mental Health Crisis</a>
          </div>
          <div class="widget">
            <a href="#">General Emergency Support</a>
          </div>
        </div>
      </div>
      <div class="input-container">
        <textarea type="text" class="input" placeholder="Message DispatchAI"></textarea>
      </div>

      
    </div>

    
    </>
    
    
  );
}

export default App;
