from flask import Flask, render_template

app = Flask(__name__, template_folder="../templates")


@app.route("/")
def home():
    # Render the landing page from templates/index.html
    return render_template("index.html")


@app.route("/optimize")
def optimize():
    return "Optimization Results Go Here"


# Vercel's Python runtime looks for `app` as the callable.
