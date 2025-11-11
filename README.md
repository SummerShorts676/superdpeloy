# Operating Systems (CPSY-300 SectionA)
This is the repository for the code for Project 2 Part 1

# Group Member
    Gomes De Toledo, Pedro Henrique
    Napolskikh, Max
    Sabo, Jimmy (George)

# Requirements
    Make sure to have:
    - Azure Functions pre-installed
    - Azure CLI pre-installed


# Steps to start
# Backend:
1. Double check `.env` variables in `get-data-data\diet-data` folder are correct.
2. Open Command Prompt (`Crtl + ~`) un `az --version` and `func --version` to check Azure Cli and Azure Functions are installed locally.
3. Setting up virtual environment:
    1. Check if .venv folder there is so run `.venv\Scripts\activate`.
    2. If there is no `.venv` folder you have to create one, run `python -m venv .venv` and make sure that `get-diet-data\diet-data` is in that environment. Return to step 3.1 to start venv.
4. Once in virtual environments cd into `cd {path-to}/get-diet-data/diet-data`.
5. Run `pip install -r requirements.txt` to install neccessary dependancies.
7. Once in folder run `func start` to start backend, must be in `diet-data` folder.

# Frontend:
1. Open a new Command Prompt (`Crtl + ~`).
2. Cd into proper directory `cd {path-to}/my-app`
2. Run `npm install`.
3. Run `npm run dev`.

Test here