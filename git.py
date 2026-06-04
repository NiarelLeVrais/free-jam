import subprocess
import sys


def run(cmd):
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"Erreur: {' '.join(cmd)}")
        sys.exit(1)


def main():
    message = input("Commentaire du commit: ").strip()
    if not message:
        print("Commentaire vide. Annule.")
        sys.exit(1)

    run(["git", "add", "."])
    run(["git", "commit", "-m", message])
    run(["git", "push"])
    print("Push fait.")


if __name__ == "__main__":
    main()
